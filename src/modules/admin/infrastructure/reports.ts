import { toCsv } from "@/core/domain/csv";
import { Booking, idOf, Salon } from "@/infrastructure/db";

/** ADM-08 : rapports de la plateforme par ville, par service et par salon, exportables (CSV Excel, impression PDF) */

export const REPORT_PERIODS = [30, 90, 365] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
export const REPORT_KINDS = ["city", "service", "salon"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

type Totals = { bookings: number; completed: number; revenue: number; cancelled: number; noShows: number };

const TOTALS = {
  bookings: { $sum: 1 },
  completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
  revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalPrice", 0] } },
  cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
  noShows: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } },
};

const rate = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 0);
const withRates = <T extends Totals>(row: T) => ({ ...row, cancelRate: rate(row.cancelled, row.bookings), noShowRate: rate(row.noShows, row.bookings), avgBasket: row.completed ? Math.round(row.revenue / row.completed) : 0 });

export async function platformReports(days: ReportPeriod = 30, now = new Date()) {
  const match = { $match: { startsAt: { $gte: new Date(now.getTime() - days * 86_400_000), $lt: now } } };
  const [bySalonRaw, byServiceRaw, salons] = await Promise.all([
    Booking.aggregate<Totals & { _id: unknown }>([match, { $group: { _id: "$salon", ...TOTALS } }]),
    Booking.aggregate<{ _id: string; bookings: number; revenue: number }>([
      match,
      { $match: { status: { $ne: "CANCELLED" } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", bookings: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$items.price", 0] } } } },
      { $sort: { bookings: -1 } },
      { $limit: 40 },
    ]),
    Salon.find({}, { name: 1, city: 1, plan: 1, status: 1, ratingAvg: 1, reviewCount: 1 }).lean(),
  ]);

  const salonRows = salons
    .filter((s) => s.status === "ACTIVE" || bySalonRaw.some((r) => String(r._id) === idOf(s)))
    .map((s) => {
      const raw = bySalonRaw.find((r) => String(r._id) === idOf(s));
      return withRates({ id: idOf(s), name: s.name, city: s.city, plan: s.plan, rating: s.ratingAvg, reviews: s.reviewCount, bookings: raw?.bookings ?? 0, completed: raw?.completed ?? 0, revenue: raw?.revenue ?? 0, cancelled: raw?.cancelled ?? 0, noShows: raw?.noShows ?? 0 });
    })
    .sort((a, b) => b.revenue - a.revenue);

  const cities = new Map<string, Totals & { salons: number; ratingSum: number; rated: number }>();
  for (const s of salonRows) {
    const c = cities.get(s.city) ?? { salons: 0, bookings: 0, completed: 0, revenue: 0, cancelled: 0, noShows: 0, ratingSum: 0, rated: 0 };
    cities.set(s.city, {
      salons: c.salons + 1,
      bookings: c.bookings + s.bookings,
      completed: c.completed + s.completed,
      revenue: c.revenue + s.revenue,
      cancelled: c.cancelled + s.cancelled,
      noShows: c.noShows + s.noShows,
      ratingSum: c.ratingSum + (s.reviews ? s.rating : 0),
      rated: c.rated + (s.reviews ? 1 : 0),
    });
  }
  const cityRows = [...cities.entries()]
    .map(([city, c]) => withRates({ city, salons: c.salons, bookings: c.bookings, completed: c.completed, revenue: c.revenue, cancelled: c.cancelled, noShows: c.noShows, rating: c.rated ? Math.round((c.ratingSum / c.rated) * 10) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const serviceRows = byServiceRaw.map((s) => ({ service: s._id, bookings: s.bookings, revenue: s.revenue }));
  const totals = salonRows.reduce((acc, s) => ({ bookings: acc.bookings + s.bookings, completed: acc.completed + s.completed, revenue: acc.revenue + s.revenue }), { bookings: 0, completed: 0, revenue: 0 });

  return { days, totals, cities: cityRows, services: serviceRows, salons: salonRows };
}

export type PlatformReports = Awaited<ReturnType<typeof platformReports>>;

/** Export CSV (Excel) d'un rapport */
export async function platformReportCsv(kind: ReportKind, days: ReportPeriod = 30, now = new Date()) {
  const r = await platformReports(days, now);
  if (kind === "city") {
    return toCsv(
      ["Ville", "Salons", "Rendez-vous", "Terminés", "Chiffre d'affaires (DT)", "Panier moyen (DT)", "Annulations (%)", "Absences (%)", "Note moyenne"],
      r.cities.map((c) => [c.city, c.salons, c.bookings, c.completed, c.revenue, c.avgBasket, c.cancelRate, c.noShowRate, c.rating])
    );
  }
  if (kind === "service") {
    return toCsv(
      ["Prestation", "Réservations", "Chiffre d'affaires (DT)"],
      r.services.map((s) => [s.service, s.bookings, s.revenue])
    );
  }
  return toCsv(
    ["Salon", "Ville", "Plan", "Rendez-vous", "Terminés", "Chiffre d'affaires (DT)", "Panier moyen (DT)", "Annulations (%)", "Absences (%)", "Note", "Avis"],
    r.salons.map((s) => [s.name, s.city, s.plan, s.bookings, s.completed, s.revenue, s.avgBasket, s.cancelRate, s.noShowRate, s.rating, s.reviews])
  );
}
