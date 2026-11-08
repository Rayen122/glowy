import type { Actor } from "@/core/domain/actor";
import { conflict, forbidden, notFound } from "@/core/domain/errors";
import { tunisDayRange, tunisToday, utcToTunis } from "@/core/domain/time";
import { Booking, Employee, objectId, Payslip, Salon } from "@/infrastructure/db";
import { currentSalonId } from "@/modules/dashboard";
import { notify, payslipReady } from "@/modules/notifications";
import { computePayslip, daysInPeriod, DEFAULT_PAYROLL_RATES, previousPeriod, type MonthSummary, type PayrollRates, type PayslipLines } from "../domain/payroll";
import type { PayrollSettingsInput, PayslipUpdateInput } from "../application/schemas";
import { employeeMonth, employeeOfUser } from "./attendance";

/** Fiches de paie : brouillon calculé à partir du pointage, ajusté (prime, avance) puis validé par le gérant */

export async function payrollRates(salonId: string): Promise<PayrollRates> {
  const salon = await Salon.findById(objectId(salonId), { payrollSettings: 1 }).lean();
  const own = salon?.payrollSettings;
  return { cnssRate: own?.cnssRate ?? DEFAULT_PAYROLL_RATES.cnssRate, cssRate: own?.cssRate ?? DEFAULT_PAYROLL_RATES.cssRate, irpp: own?.irpp ?? DEFAULT_PAYROLL_RATES.irpp };
}

export async function updatePayrollRates(actor: Actor, input: PayrollSettingsInput) {
  const salonId = await currentSalonId(actor);
  await Salon.updateOne({ _id: objectId(salonId) }, { $set: { payrollSettings: input } });
  return payrollRates(salonId);
}

/** Chiffre d'affaires des rendez-vous terminés du professionnel sur le mois (base de sa commission) */
async function completedRevenue(employeeId: unknown, period: string) {
  const dates = daysInPeriod(period);
  const [row] = await Booking.aggregate<{ total: number }>([
    { $match: { employee: employeeId, status: "COMPLETED", startsAt: { $gte: tunisDayRange(dates[0]).start, $lt: tunisDayRange(dates.at(-1)!).end } } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);
  return row?.total ?? 0;
}

/** Calcule (ou recalcule) le brouillon d'un professionnel ; une fiche validée n'est jamais modifiée */
async function buildDraft(employeeId: string, period: string, now: Date) {
  const employee = await Employee.findById(objectId(employeeId)).lean();
  if (!employee) throw notFound("Professionnel introuvable.");
  const existing = await Payslip.findOne({ employee: employee._id, period }).lean();
  if (existing?.status === "VALIDATED") return existing;
  const [month, revenue, rates] = await Promise.all([employeeMonth(employeeId, period, now), completedRevenue(employee._id, period), payrollRates(String(employee.salon))]);
  const bonus = existing?.bonus ?? 0;
  const advance = existing?.advance ?? 0;
  const lines = computePayslip({ baseSalary: employee.baseSalary ?? 0, overtimeRate: employee.overtimeRate ?? 25, commissionRate: employee.commissionRate ?? 0, revenue, summary: month.summary, bonus, advance, rates });
  return Payslip.findOneAndUpdate(
    { employee: employee._id, period },
    {
      $set: {
        salon: employee.salon,
        status: "DRAFT",
        employeeName: employee.name,
        employeeTitle: employee.title,
        baseSalary: employee.baseSalary ?? 0,
        overtimeRate: employee.overtimeRate ?? 25,
        commissionRate: employee.commissionRate ?? 0,
        revenue,
        summary: month.summary,
        lines,
        rates,
      },
    },
    { upsert: true, returnDocument: "after" }
  ).lean();
}

/** Brouillons du mois pour tous les professionnels actifs du salon (fiches validées laissées telles quelles) */
export async function generatePayslips(salonId: string, period: string, now = new Date()) {
  if (period > tunisToday(now).slice(0, 7)) throw conflict("FUTURE_PERIOD", "Ce mois n'a pas encore commencé.");
  const employees = await Employee.find({ salon: objectId(salonId), active: true }, { _id: 1 }).lean();
  for (const e of employees) await buildDraft(String(e._id), period, now);
  return employees.length;
}

export async function generateForActor(actor: Actor, period: string, now = new Date()) {
  return { count: await generatePayslips(await currentSalonId(actor), period, now), period };
}

async function managedPayslip(actor: Actor, payslipId: string) {
  const salon = objectId(await currentSalonId(actor));
  const slip = objectId(payslipId) ? await Payslip.findOne({ _id: objectId(payslipId), salon }).lean() : null;
  if (!slip) throw notFound("Fiche de paie introuvable.");
  return slip;
}

const periodLabel = (period: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-15T12:00:00Z`));

/** PATCH /api/payroll/payslips/[id] : prime, avance, note ; recalcul ; validation (l'employé est prévenu) */
export async function updatePayslip(actor: Actor, payslipId: string, input: PayslipUpdateInput, now = new Date()) {
  const slip = await managedPayslip(actor, payslipId);
  if (slip.status === "VALIDATED") throw conflict("PAYSLIP_VALIDATED", "Cette fiche de paie est déjà validée.");
  const changes: Record<string, unknown> = {};
  if (input.bonus !== undefined) changes.bonus = input.bonus;
  if (input.advance !== undefined) changes.advance = input.advance;
  if (input.note !== undefined) changes.note = input.note || null;
  if (Object.keys(changes).length) await Payslip.updateOne({ _id: slip._id }, { $set: changes });
  // Prime et avance changent le net : le brouillon est toujours recalculé avant d'être enregistré ou validé
  await buildDraft(String(slip.employee), slip.period, now);
  if (input.action === "validate") {
    await Payslip.updateOne({ _id: slip._id }, { $set: { status: "VALIDATED", validatedAt: now, validatedBy: objectId(actor.id) } });
    const employee = await Employee.findById(slip.employee, { user: 1 }).lean();
    if (employee?.user) await notify(String(employee.user), payslipReady(periodLabel(slip.period), String(slip._id)));
  }
  return payslipView(await Payslip.findById(slip._id).lean());
}

type PayslipDoc = NonNullable<Awaited<ReturnType<typeof managedPayslip>>>;

function payslipView(slip: PayslipDoc | null) {
  if (!slip) throw notFound("Fiche de paie introuvable.");
  return {
    id: String(slip._id),
    employeeId: String(slip.employee),
    period: slip.period,
    status: slip.status as "DRAFT" | "VALIDATED",
    employeeName: slip.employeeName,
    employeeTitle: slip.employeeTitle ?? "",
    baseSalary: slip.baseSalary ?? 0,
    overtimeRate: slip.overtimeRate ?? 0,
    commissionRate: slip.commissionRate ?? 0,
    revenue: slip.revenue ?? 0,
    bonus: slip.bonus ?? 0,
    advance: slip.advance ?? 0,
    note: slip.note ?? null,
    summary: slip.summary as MonthSummary,
    lines: slip.lines as PayslipLines,
    rates: slip.rates as PayrollRates,
    validatedAt: slip.validatedAt ? utcToTunis(slip.validatedAt).date : null,
  };
}

export type PayslipView = ReturnType<typeof payslipView>;

/** Fiches d'un mois pour le gérant (tous les professionnels du salon) */
export async function salonPayslips(actor: Actor, period: string) {
  const salon = objectId(await currentSalonId(actor));
  const slips = await Payslip.find({ salon, period }).sort({ employeeName: 1 }).lean();
  return slips.map(payslipView);
}

/** Fiches validées du professionnel connecté, de la plus récente à la plus ancienne */
export async function myPayslips(userId: string) {
  const employee = await employeeOfUser(userId);
  const slips = await Payslip.find({ employee: employee._id, status: "VALIDATED" }).sort({ period: -1 }).lean();
  return slips.map(payslipView);
}

/** Une fiche : le gérant du salon (brouillon compris) ou le professionnel concerné (fiche validée seulement) */
export async function payslipFor(actor: Actor, payslipId: string) {
  const slip = objectId(payslipId) ? await Payslip.findById(objectId(payslipId)).lean() : null;
  if (!slip) throw notFound("Fiche de paie introuvable.");
  if (actor.role === "EMPLOYEE") {
    const employee = await employeeOfUser(actor.id);
    if (String(employee._id) !== String(slip.employee) || slip.status !== "VALIDATED") throw forbidden("Cette fiche de paie ne vous est pas destinée.");
  } else if (String(slip.salon) !== (await currentSalonId(actor))) {
    throw forbidden("Cette fiche de paie ne concerne pas votre salon.");
  }
  const salon = await Salon.findById(slip.salon, { name: 1, address: 1, city: 1 }).lean();
  return { ...payslipView(slip), salon: { name: salon?.name ?? "", address: [salon?.address, salon?.city].filter(Boolean).join(", ") } };
}

/**
 * Planificateur : le dernier jour du mois à partir de 21 h, brouillons du mois ; les 3 premiers jours du mois suivant,
 * brouillons du mois précédent recalculés (derniers pointages compris). Idempotent : les fiches validées ne bougent pas.
 */
export async function ensureMonthlyPayslips(now = new Date()) {
  const { date, time } = utcToTunis(now);
  const period = date.slice(0, 7);
  const lastDay = daysInPeriod(period).at(-1) === date;
  const targets = [...(lastDay && time >= "21:00" ? [period] : []), ...(Number(date.slice(8)) <= 3 ? [previousPeriod(period)] : [])];
  if (!targets.length) return 0;
  const salons = await Employee.distinct("salon", { active: true });
  let built = 0;
  for (const target of targets) {
    for (const salon of salons) {
      // Brouillons recalculés au plus une fois par heure
      const fresh = await Payslip.exists({ salon, period: target, updatedAt: { $gt: new Date(now.getTime() - 3_600_000) } });
      if (!fresh) built += await generatePayslips(String(salon), target, now);
    }
  }
  return built;
}
