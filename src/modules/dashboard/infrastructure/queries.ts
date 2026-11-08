import { cache } from "react";
import type { Actor } from "@/core/domain/actor";
import { notFound } from "@/core/domain/errors";
import { shortName } from "@/core/domain/text";
import { addDays, toMinutes, tunisDayRange, tunisToday, utcToTunis, weekdayOf } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Review, Salon, User } from "@/infrastructure/db";
import { salonAgenda, staffActions } from "@/modules/booking";
import { currentSalonId } from "./current-salon";

/** Dashboard salon (P2, SAL-01) : vue du jour calculée depuis les réservations. */

const UI_STATUS = { COMPLETED: "termine", IN_PROGRESS: "en_cours", CONFIRMED: "confirme", PENDING: "a_confirmer", NO_SHOW: "absent", CANCELLED: "absent" } as const;

/** Salon du membre du personnel connecté (mis en cache le temps d'une requête) */
export const staffSalon = cache(async (actor: Actor) => {
  const salonId = await currentSalonId(actor);
  const salon = await Salon.findById(objectId(salonId), { slug: 1, name: 1, city: 1, coverUrl: 1, plan: 1, status: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  return { id: idOf(salon), slug: salon.slug, name: salon.name, city: salon.city, coverUrl: salon.coverUrl ?? null, plan: salon.plan, status: salon.status };
});

export async function salonDay(salonId: string, date = tunisToday(), now = new Date()) {
  const agenda = await salonAgenda(salonId, date);
  const keyOf = new Map(agenda.employees.map((e) => [e.id, e]));
  const bookings = agenda.bookings.map((b) => ({
    ...b,
    employee: keyOf.get(b.employeeId)?.key ?? "",
    employeeName: keyOf.get(b.employeeId)?.name ?? "",
    color: keyOf.get(b.employeeId)?.color ?? 1,
    uiStatus: UI_STATUS[b.status],
    /** Boutons proposés au salon maintenant (pas de « terminé » / « absente » avant l'heure) */
    // Refuser une demande ; annuler un rendez-vous confirmé pas encore commencé (professionnelle malade…)
    actions: [
      ...staffActions(b.status, b.startsAt, now),
      ...(b.status === "PENDING" ? (["decline"] as const) : []),
      ...(b.status === "CONFIRMED" && b.startsAt > now ? (["cancel"] as const) : []),
    ],
  }));
  return { ...agenda, bookings };
}

/** Indicateurs du jour : rendez-vous, chiffre d'affaires, remplissage, absences sur 30 jours */
export async function salonKpis(salonId: string, now = new Date()) {
  const date = tunisToday(now);
  const salon = objectId(salonId);
  const [day, salonDoc, noShows30] = await Promise.all([
    salonDay(salonId, date, now),
    Salon.findById(salon, { openingHours: 1 }).lean(),
    Booking.countDocuments({ salon, status: "NO_SHOW", startsAt: { $gte: new Date(now.getTime() - 30 * 86_400_000) } }),
  ]);
  const opening = salonDoc?.openingHours.find((o) => o.weekday === weekdayOf(date)) ?? null;
  const counted = day.bookings.filter((b) => b.status !== "NO_SHOW");
  const bookedMinutes = counted.reduce((a, b) => a + (toMinutes(b.end) - toMinutes(b.time)), 0);
  const openMinutes = opening ? (toMinutes(opening.closesAt ?? "00:00") - toMinutes(opening.opensAt ?? "00:00")) * Math.max(1, day.employees.length) : 0;
  return {
    day,
    bookingsToday: day.bookings.length,
    revenueToday: counted.reduce((a, b) => a + b.price, 0),
    fillRate: openMinutes ? Math.min(1, bookedMinutes / openMinutes) : 0,
    noShows30,
    nowTime: utcToTunis(now).time,
  };
}

export async function recentSalonReviews(salonId: string, take = 3) {
  const reviews = await Review.find({ salon: objectId(salonId) }).sort({ createdAt: -1 }).limit(take).lean();
  const clients = await User.find({ _id: { $in: reviews.map((r) => r.client) } }, { firstName: 1, lastName: 1 }).lean();
  const clientById = new Map(clients.map((c) => [idOf(c), c]));
  return reviews.map((r) => {
    const client = clientById.get(r.client.toString());
    return {
      id: idOf(r),
      author: shortName(client?.firstName ?? "", client?.lastName ?? ""),
      rating: r.rating,
      text: r.text,
      lang: r.lang,
      sentiment: (r.sentiment ?? "neutre") as "positif" | "neutre" | "negatif",
      suspicion: r.suspicion ?? 0,
    };
  });
}

/** SAL-04 : rendez-vous d'une période (vues semaine et mois de l'agenda), regroupés par jour */
export async function salonRange(salonId: string, from: string, days: number) {
  const salon = objectId(salonId)!;
  const start = tunisDayRange(from).start;
  const end = tunisDayRange(addDays(from, days - 1)).end;
  const [salonDoc, employees, bookings] = await Promise.all([
    Salon.findById(salon, { openingHours: 1 }).lean(),
    Employee.find({ salon, active: true }, { name: 1, color: 1 }).sort({ createdAt: 1 }).lean(),
    Booking.find({ salon, startsAt: { $gte: start, $lt: end }, status: { $ne: "CANCELLED" } }, { client: 1, employee: 1, startsAt: 1, endsAt: 1, status: 1, totalPrice: 1, items: 1 })
      .sort({ startsAt: 1 })
      .lean(),
  ]);
  const clients = await User.find({ _id: { $in: bookings.map((b) => b.client) } }, { firstName: 1, lastName: 1 }).lean();
  const colorOf = new Map(employees.map((e) => [idOf(e), e.color]));
  const byDay = new Map<string, typeof rows>();
  const rows = bookings.map((b) => {
    const client = clients.find((c) => c._id.equals(b.client));
    const local = utcToTunis(b.startsAt);
    return {
      id: idOf(b),
      date: local.date,
      time: local.time,
      end: utcToTunis(b.endsAt).time,
      client: client ? shortName(client.firstName, client.lastName) : "",
      service: b.items.map((i) => i.name).join(" + "),
      employeeId: b.employee.toString(),
      color: colorOf.get(b.employee.toString()) ?? 1,
      status: b.status,
      price: b.totalPrice,
    };
  });
  for (const r of rows) byDay.set(r.date, [...(byDay.get(r.date) ?? []), r]);
  return {
    employees: employees.map((e) => ({ id: idOf(e), name: e.name, color: e.color })),
    days: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const list = byDay.get(date) ?? [];
      const opening = salonDoc?.openingHours.find((o) => o.weekday === weekdayOf(date));
      return {
        date,
        open: Boolean(opening?.opensAt),
        bookings: list,
        revenue: list.filter((b) => b.status === "COMPLETED").reduce((a, b) => a + b.price, 0),
      };
    }),
  };
}
