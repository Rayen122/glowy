import type { Types } from "mongoose";
import type { Actor } from "@/core/domain/actor";
import { conflict, forbidden, notFound } from "@/core/domain/errors";
import { addDays, toMinutes, tunisDayRange, tunisToday, tunisToUtc, utcToTunis, weekdayOf } from "@/core/domain/time";
import { Attendance, Employee, objectId, Salon, TimeOff } from "@/infrastructure/db";
import { currentSalonId } from "@/modules/dashboard";
import { classifyDay, daysInPeriod, summarizeMonth, workedMinutes, type DayInput } from "../domain/payroll";
import type { AttendanceInput } from "../application/schemas";

/** Pointage (arrivée / départ) des professionnels et dossier mensuel jour par jour */

type EmployeeDoc = { _id: unknown; salon: unknown; workingHours: { weekday?: number | null; startsAt?: string | null; endsAt?: string | null; off?: boolean | null }[] };
type Opening = { weekday?: number | null; opensAt?: string | null; closesAt?: string | null };

/** Fiche du professionnel lié au compte connecté (rôle Employé) */
export async function employeeOfUser(userId: string) {
  const employee = await Employee.findOne({ user: objectId(userId), active: true }).lean();
  if (!employee) throw forbidden("Aucune fiche de professionnel n'est liée à ce compte.");
  return employee;
}

/** Professionnel du salon géré (gérant, Super Admin) */
export async function managedEmployee(actor: Actor, employeeId: string) {
  const salon = objectId(await currentSalonId(actor));
  const employee = objectId(employeeId) ? await Employee.findOne({ _id: objectId(employeeId), salon }).lean() : null;
  if (!employee) throw notFound("Professionnel introuvable.");
  return employee;
}

/** Minutes prévues un jour donné : horaires propres du professionnel, sinon ceux du salon */
export function plannedMinutesOn(date: string, employee: EmployeeDoc, opening: Opening[]) {
  const weekday = weekdayOf(date);
  const own = employee.workingHours.find((w) => w.weekday === weekday);
  if (own) return own.off || !own.startsAt || !own.endsAt ? 0 : Math.max(0, toMinutes(own.endsAt) - toMinutes(own.startsAt));
  const salon = opening.find((o) => o.weekday === weekday && o.opensAt && o.closesAt);
  return salon ? Math.max(0, toMinutes(salon.closesAt!) - toMinutes(salon.opensAt!)) : 0;
}

const hhmm = (at: Date | null) => (at ? utcToTunis(at).time : null);

/** POST /api/payroll/clock : arrivée ou départ du professionnel connecté, à l'heure du serveur */
export async function clock(userId: string, action: "in" | "out", now = new Date()) {
  const employee = await employeeOfUser(userId);
  const date = tunisToday(now);
  // Une arrivée encore ouverte : celle du jour, ou celle de la veille pour un départ après minuit
  const openDay = await Attendance.findOne({ employee: employee._id, date: { $in: [date, addDays(date, -1)] }, segments: { $elemMatch: { out: null } } }).sort({ date: -1 }).lean();
  if (action === "in") {
    if (openDay?.date === date) throw conflict("ALREADY_IN", "Votre arrivée est déjà pointée.");
    await Attendance.updateOne({ employee: employee._id, date }, { $setOnInsert: { salon: employee.salon }, $push: { segments: { in: now, out: null } } }, { upsert: true });
  } else {
    if (!openDay) throw conflict("NOT_IN", "Pointez d'abord votre arrivée.");
    await Attendance.updateOne({ _id: openDay._id }, { $set: { "segments.$[open].out": now } }, { arrayFilters: [{ "open.out": null }] });
  }
  return todayOf(employee, now);
}

/** Pointage du jour d'un professionnel : périodes, présent en ce moment ou non, minutes travaillées */
async function todayOf(employee: { _id: Types.ObjectId }, now: Date) {
  const day = await Attendance.findOne({ employee: employee._id, date: tunisToday(now) }).lean();
  const segments = day?.segments ?? [];
  return {
    date: tunisToday(now),
    status: (day?.status ?? null) as "ABSENT" | "EXCUSED" | null,
    present: segments.some((s) => !s.out),
    segments: segments.map((s) => ({ in: hhmm(s.in)!, out: hhmm(s.out ?? null) })),
    workedMinutes: workedMinutes(segments.map((s) => ({ in: s.in, out: s.out ?? null })), now),
  };
}

export async function myToday(userId: string, now = new Date()) {
  return todayOf(await employeeOfUser(userId), now);
}

/** Congés du mois (TimeOff) : un jour est « en congé » si le congé couvre au moins la moitié du temps prévu */
function leaveDays(dates: string[], planned: Map<string, number>, timeOff: { startsAt: Date; endsAt: Date }[]) {
  const set = new Set<string>();
  for (const date of dates) {
    const { start, end } = tunisDayRange(date);
    const covered = timeOff.reduce((m, t) => m + Math.max(0, Math.min(end.getTime(), t.endsAt.getTime()) - Math.max(start.getTime(), t.startsAt.getTime())) / 60_000, 0);
    const need = planned.get(date) ?? 0;
    if (need > 0 && covered >= need / 2) set.add(date);
  }
  return set;
}

/** Dossier du mois d'un professionnel : chaque jour (prévu, pointé, heures sup, statut) et le total */
export async function employeeMonth(employeeId: string, period: string, now = new Date()) {
  const employee = await Employee.findById(objectId(employeeId)).lean();
  if (!employee) throw notFound("Professionnel introuvable.");
  const salon = await Salon.findById(employee.salon, { openingHours: 1 }).lean();
  const dates = daysInPeriod(period);
  const range = { start: tunisDayRange(dates[0]).start, end: tunisDayRange(dates.at(-1)!).end };
  const [records, timeOff] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: dates[0], $lte: dates.at(-1)! } }).lean(),
    TimeOff.find({ employee: employee._id, startsAt: { $lt: range.end }, endsAt: { $gt: range.start } }, { startsAt: 1, endsAt: 1 }).lean(),
  ]);
  const planned = new Map(dates.map((d) => [d, plannedMinutesOn(d, employee, salon?.openingHours ?? [])]));
  const leave = leaveDays(dates, planned, timeOff);
  const today = tunisToday(now);
  const days = dates.map((date) => {
    const record = records.find((r) => r.date === date);
    const segments = (record?.segments ?? []).map((s) => ({ in: s.in, out: s.out ?? null }));
    const input: DayInput = {
      date,
      plannedMinutes: planned.get(date) ?? 0,
      workedMinutes: segments.length ? workedMinutes(segments, now) : null,
      leave: leave.has(date) || record?.status === "EXCUSED",
      markedAbsent: record?.status === "ABSENT",
    };
    return { ...classifyDay(input, today), segments: segments.map((s) => ({ in: hhmm(s.in)!, out: hhmm(s.out) })), note: record?.note ?? null };
  });
  return { employee: { id: String(employee._id), name: employee.name, title: employee.title }, period, days, summary: summarizeMonth(days) };
}

export type EmployeeMonth = Awaited<ReturnType<typeof employeeMonth>>;

/** Tableau du jour pour le gérant : chaque professionnel actif, temps prévu et pointage */
export async function salonToday(actor: Actor, now = new Date()) {
  const salonId = objectId(await currentSalonId(actor));
  const [employees, salon] = await Promise.all([Employee.find({ salon: salonId, active: true }).sort({ createdAt: 1 }).lean(), Salon.findById(salonId, { openingHours: 1 }).lean()]);
  return Promise.all(
    employees.map(async (e) => ({
      id: String(e._id),
      name: e.name,
      title: e.title,
      plannedMinutes: plannedMinutesOn(tunisToday(now), e, salon?.openingHours ?? []),
      hasAccount: Boolean(e.user),
      ...(await todayOf(e, now)),
    }))
  );
}

export type SalonTodayRow = Awaited<ReturnType<typeof salonToday>>[number];

/** PUT /api/payroll/attendance : correction par le gérant (heures, absence justifiée ou non) — date passée ou du jour */
export async function correctAttendance(actor: Actor, input: AttendanceInput, now = new Date()) {
  const employee = await managedEmployee(actor, input.employeeId);
  if (input.date > tunisToday(now)) throw conflict("FUTURE_DATE", "On ne peut pas pointer un jour à venir.");
  if (input.date < addDays(tunisToday(now), -62)) throw conflict("TOO_OLD", "Ce jour est trop ancien pour être corrigé.");
  const segments = input.status === "PRESENT" ? input.segments.map((s) => ({ in: tunisToUtc(input.date, s.in), out: s.out ? tunisToUtc(input.date, s.out) : null })) : [];
  await Attendance.updateOne(
    { employee: employee._id, date: input.date },
    { $set: { salon: employee.salon, segments, status: input.status === "PRESENT" ? null : input.status, note: input.note || null, correctedBy: objectId(actor.id) } },
    { upsert: true }
  );
  return { employeeId: input.employeeId, date: input.date };
}
