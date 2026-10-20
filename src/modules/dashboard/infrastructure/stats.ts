import { toCsv } from "@/core/domain/csv";
import { addDays, tunisDayRange, tunisToday, utcToTunis } from "@/core/domain/time";
import { shortName } from "@/core/domain/text";
import { Booking, Employee, objectId, User } from "@/infrastructure/db";

/** SAL-06 : statistiques réelles du salon, calculées sur les réservations (fuseau de Tunis) */

export const STAT_PERIODS = [7, 30, 90, 365] as const;
export type StatPeriod = (typeof STAT_PERIODS)[number];
const TZ = "Africa/Tunis";

const pct = (part: number, total: number) => (total ? part / total : 0);

/** Fenêtre [début, fin[ de `days` jours se terminant aujourd'hui (inclus), et la fenêtre précédente de même durée */
function windows(days: number, now: Date) {
  const today = tunisToday(now);
  const end = tunisDayRange(today).end;
  const start = tunisDayRange(addDays(today, -(days - 1))).start;
  const prevStart = tunisDayRange(addDays(today, -(2 * days - 1))).start;
  return { start, end, prevStart, firstDay: addDays(today, -(days - 1)), today };
}

export async function salonStats(salonId: string, days: StatPeriod = 30, now = new Date()) {
  const salon = objectId(salonId);
  const { start, end, prevStart, firstDay } = windows(days, now);
  const inPeriod = { salon, startsAt: { $gte: start, $lt: end } };
  const monthly = days === 365;

  const [totals, previous, series, services, peaks, staff, clientsFirst, earliest] = await Promise.all([
    Booking.aggregate<{ _id: string; count: number; revenue: number }>([{ $match: inPeriod }, { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } }]),
    Booking.aggregate<{ revenue: number }>([{ $match: { salon, status: "COMPLETED", startsAt: { $gte: prevStart, $lt: start } } }, { $group: { _id: null, revenue: { $sum: "$totalPrice" } } }]),
    Booking.aggregate<{ _id: string; revenue: number; count: number }>([
      { $match: { ...inPeriod, status: "COMPLETED" } },
      { $group: { _id: { $dateToString: { date: "$startsAt", format: monthly ? "%Y-%m-01" : "%Y-%m-%d", timezone: TZ } }, revenue: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ _id: string; count: number; revenue: number }>([
      { $match: { ...inPeriod, status: "COMPLETED" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.name", count: { $sum: 1 }, revenue: { $sum: "$items.price" } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Booking.aggregate<{ _id: { d: number; h: number }; count: number }>([
      { $match: { ...inPeriod, status: { $ne: "CANCELLED" } } },
      { $group: { _id: { d: { $dayOfWeek: { date: "$startsAt", timezone: TZ } }, h: { $hour: { date: "$startsAt", timezone: TZ } } }, count: { $sum: 1 } } },
    ]),
    Booking.aggregate<{ _id: unknown; count: number; revenue: number; noShows: number }>([
      { $match: { ...inPeriod, status: { $in: ["COMPLETED", "NO_SHOW"] } } },
      { $group: { _id: "$employee", count: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } }, revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalPrice", 0] } }, noShows: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } } } },
    ]),
    // Première visite de chaque cliente dans ce salon : nouvelles clientes de la période
    Booking.aggregate<{ _id: unknown; first: Date }>([{ $match: { salon, status: { $ne: "CANCELLED" } } }, { $group: { _id: "$client", first: { $min: "$startsAt" } } }, { $match: { first: { $gte: start, $lt: end } } }]),
    Booking.findOne({ salon }, { startsAt: 1 }).sort({ startsAt: 1 }).lean(),
  ]);

  const by = (status: string) => totals.find((t) => t._id === status) ?? { count: 0, revenue: 0 };
  const completed = by("COMPLETED");
  const cancelled = by("CANCELLED");
  const noShow = by("NO_SHOW");
  const all = totals.reduce((a, t) => a + t.count, 0);
  const revenue = completed.revenue;
  const previousRevenue = previous[0]?.revenue ?? 0;

  // Série continue (jours ou mois sans activité = 0)
  const bucket = new Map(series.map((s) => [s._id, s.revenue]));
  const points: { date: string; revenue: number }[] = [];
  if (monthly) {
    const [y, m] = tunisToday(now).split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 10);
      points.push({ date: d, revenue: bucket.get(d) ?? 0 });
    }
  } else {
    for (let i = 0; i < days; i++) {
      const d = addDays(firstDay, i);
      points.push({ date: d, revenue: bucket.get(d) ?? 0 });
    }
  }

  // Heures de pointe : lundi → samedi (et dimanche s'il y a de l'activité), 8 h → 20 h
  const peakDays = [1, 2, 3, 4, 5, 6, ...(peaks.some((p) => p._id.d === 1) ? [0] : [])];
  const peakHours = Array.from({ length: 13 }, (_, i) => 8 + i);
  const peakMax = Math.max(1, ...peaks.map((p) => p.count));
  const peakValues = peakDays.map((d) => peakHours.map((h) => Math.round((100 * (peaks.find((p) => p._id.d === d + 1 && p._id.h === h)?.count ?? 0)) / peakMax)));

  const employees = await Employee.find({ _id: { $in: staff.map((s) => s._id) } }, { name: 1, color: 1, commissionRate: 1 }).lean();
  const byEmployee = staff
    .map((s) => {
      const e = employees.find((x) => x._id.equals(s._id as never));
      const rate = e?.commissionRate ?? 0;
      // SAL-13 : commission du professionnel sur le CA de ses rendez-vous terminés
      return { name: e?.name ?? "—", color: e?.color ?? 1, count: s.count, revenue: s.revenue, noShows: s.noShows, rate, commission: Math.round(s.revenue * rate * 10) / 1000 };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    days,
    from: firstDay,
    revenue,
    // Comparaison seulement si l'historique couvre toute la période précédente (sinon le pourcentage n'a pas de sens)
    revenueChange: previousRevenue && earliest && earliest.startsAt <= prevStart ? (revenue - previousRevenue) / previousRevenue : null,
    bookings: all,
    completed: completed.count,
    averageBasket: completed.count ? Math.round(revenue / completed.count) : 0,
    cancelled: cancelled.count,
    cancelRate: pct(cancelled.count, all),
    noShows: noShow.count,
    noShowRate: pct(noShow.count, all),
    newClients: clientsFirst.length,
    series: points,
    monthly,
    services: services.map((s) => ({ name: s._id, count: s.count, revenue: s.revenue })),
    peaks: { days: peakDays, hours: peakHours, values: peakValues },
    byEmployee,
  };
}

export type SalonStats = Awaited<ReturnType<typeof salonStats>>;

const STATUS_FR: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
};

/** SAL-11 : export des rendez-vous de la période (CSV lisible par Excel : UTF-8 avec BOM, séparateur « ; ») */
export async function salonBookingsCsv(salonId: string, days: StatPeriod = 30, now = new Date()) {
  const salon = objectId(salonId);
  const { start, end } = windows(days, now);
  const rows = await Booking.find({ salon, startsAt: { $gte: start, $lt: end } }).sort({ startsAt: 1 }).lean();
  const [clients, employees] = await Promise.all([
    User.find({ _id: { $in: rows.map((r) => r.client) } }, { firstName: 1, lastName: 1 }).lean(),
    Employee.find({ _id: { $in: rows.map((r) => r.employee) } }, { name: 1 }).lean(),
  ]);
  const clientName = new Map(clients.map((c) => [c._id.toString(), shortName(c.firstName, c.lastName)]));
  const employeeName = new Map(employees.map((e) => [e._id.toString(), e.name]));
  return toCsv(
    ["Date", "Heure", "Cliente", "Prestations", "Professionnel", "Statut", "Montant (DT)", "Acompte (DT)", "Paiement"],
    rows.map((r) => {
      const local = utcToTunis(r.startsAt);
      return [
        local.date,
        local.time,
        clientName.get(r.client.toString()) ?? "",
        r.items.map((i) => i.name).join(" + "),
        employeeName.get(r.employee.toString()) ?? "",
        STATUS_FR[r.status] ?? r.status,
        r.totalPrice,
        r.deposit,
        r.paymentMethod === "ONLINE" ? "En ligne" : "Sur place",
      ];
    })
  );
}
