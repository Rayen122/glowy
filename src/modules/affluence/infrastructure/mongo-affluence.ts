import { addDays, toMinutes, tunisDayRange, tunisToday, utcToTunis, weekdayOf } from "@/core/domain/time";
import { Booking, Employee, objectId, QueueEntry, Salon } from "@/infrastructure/db";
import { bestWindow, forecastDay, liveStatus, waitFor, WEEKS } from "../domain/forecast";

const ACTIVE = ["CONFIRMED", "IN_PROGRESS"] as const;
const local = (d: Date) => toMinutes(utcToTunis(d).time);

/** IA P2 : prévision horaire d'une journée à partir des mêmes jours des 8 semaines précédentes */
export async function salonForecast(salonId: string, date = tunisToday(), now = new Date()) {
  const salon = objectId(salonId);
  const [doc, capacity] = await Promise.all([Salon.findById(salon, { openingHours: 1 }).lean(), Employee.countDocuments({ salon, active: true })]);
  const weekday = weekdayOf(date);
  const opening = doc?.openingHours.find((o) => o.weekday === weekday);
  const days = Array.from({ length: WEEKS }, (_, k) => addDays(date, -7 * (k + 1)));
  const bookings = await Booking.find(
    { salon, status: { $nin: ["CANCELLED"] }, startsAt: { $gte: tunisDayRange(days[days.length - 1]).start, $lt: tunisDayRange(days[0]).end } },
    { startsAt: 1, endsAt: 1 }
  ).lean();
  const weeks = days.map((day) => {
    const { start, end } = tunisDayRange(day);
    return bookings.filter((b) => b.startsAt >= start && b.startsAt < end).map((b) => ({ start: local(b.startsAt), end: local(b.endsAt) }));
  });
  const { points, source } = forecastDay(weeks, capacity, opening?.opensAt && opening.closesAt ? { opensAt: opening.opensAt, closesAt: opening.closesAt } : null);
  const today = date === tunisToday(now);
  const currentHour = Number(utcToTunis(now).time.slice(0, 2));
  return { date, points, source, currentHour: today ? currentHour : null, best: bestWindow(points, today ? currentHour : 0) };
}

export type SalonForecast = Awaited<ReturnType<typeof salonForecast>>;

const avgDuration = (services: { durationMin: number; active: boolean }[]) => {
  const active = services.filter((s) => s.active);
  return active.length ? Math.round(active.reduce((a, s) => a + s.durationMin, 0) / active.length) : 30;
};

/** RES-08 : affluence en direct de plusieurs salons (une requête par collection) */
export async function liveAffluence(salonIds: string[], now = new Date()) {
  const ids = salonIds.map((id) => objectId(id)!).filter(Boolean);
  const [salons, employees, busy, waiting] = await Promise.all([
    Salon.find({ _id: { $in: ids } }, { services: 1 }).lean(),
    Employee.aggregate<{ _id: unknown; n: number }>([{ $match: { salon: { $in: ids }, active: true } }, { $group: { _id: "$salon", n: { $sum: 1 } } }]),
    Booking.find({ salon: { $in: ids }, status: { $in: ACTIVE }, startsAt: { $lte: now }, endsAt: { $gt: now } }, { salon: 1, employee: 1, endsAt: 1 }).lean(),
    QueueEntry.aggregate<{ _id: unknown; n: number }>([{ $match: { salon: { $in: ids }, status: "WAITING" } }, { $group: { _id: "$salon", n: { $sum: 1 } } }]),
  ]);
  return new Map(
    salons.map((s) => {
      const id = String(s._id);
      const busyUntil = busy.filter((b) => String(b.salon) === id).map((b) => (b.endsAt.getTime() - now.getTime()) / 60_000);
      const status = liveStatus({
        capacity: employees.find((e) => String(e._id) === id)?.n ?? 0,
        busyUntil,
        waiting: waiting.find((w) => String(w._id) === id)?.n ?? 0,
        avgServiceMin: avgDuration(s.services),
      });
      return [id, { ...status, waiting: waiting.find((w) => String(w._id) === id)?.n ?? 0 }];
    })
  );
}

/** Contexte de calcul d'attente d'un salon (pour la position de chaque personne de la file) */
export async function waitContext(salonId: string, now = new Date()) {
  const salon = objectId(salonId);
  const [doc, capacity, busy] = await Promise.all([
    Salon.findById(salon, { services: 1 }).lean(),
    Employee.countDocuments({ salon, active: true }),
    Booking.find({ salon, status: { $in: ACTIVE }, startsAt: { $lte: now }, endsAt: { $gt: now } }, { endsAt: 1 }).lean(),
  ]);
  const ctx = { capacity, busyUntil: busy.map((b) => (b.endsAt.getTime() - now.getTime()) / 60_000), avgServiceMin: avgDuration(doc?.services ?? []) };
  return { ...ctx, waitAt: (position: number) => waitFor(position, ctx) };
}
