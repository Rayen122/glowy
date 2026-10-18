import { shortName } from "@/core/domain/text";
import { AuditLog, Booking, idOf, Review, ReviewReport, Salon, User, type SalonDoc } from "@/infrastructure/db";
import { CATEGORY_LABEL, groupFlagged } from "../domain/policy";

/** Lectures du Super Admin : vue globale (ADM-01) et files de travail (ADM-02, AVI-06) */

const fullName = (u?: { firstName: string; lastName: string } | null) => `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim();

async function pendingSalons() {
  const salons = await Salon.find({ status: "PENDING" }).sort({ createdAt: 1 }).lean<SalonDoc[]>();
  const owners = await User.find({ _id: { $in: salons.map((s) => s.owner) } }, { firstName: 1, lastName: 1 }).lean();
  const ownerById = new Map(owners.map((o) => [idOf(o), o]));
  return salons.map((s) => ({ ...s, id: idOf(s), owner: ownerById.get(s.owner.toString()) ?? { firstName: "", lastName: "" } }));
}

/** ADM-01 : chiffres clés de la plateforme (30 derniers jours pour les réservations) */
export async function adminOverview(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [salons, clients, bookings30d, revenue, pending, openReports, plans, audit] = await Promise.all([
    Salon.countDocuments({ status: "ACTIVE" }),
    User.countDocuments({ role: "CLIENT" }),
    Booking.countDocuments({ createdAt: { $gte: since } }),
    Booking.aggregate<{ total: number }>([{ $match: { "payment.status": "PAID", "payment.createdAt": { $gte: since } } }, { $group: { _id: null, total: { $sum: "$payment.amount" } } }]),
    pendingSalons(),
    ReviewReport.countDocuments({ status: "OPEN" }),
    Salon.aggregate<{ _id: string; count: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
    AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const actors = await User.find({ _id: { $in: audit.map((a) => a.actor).filter(Boolean) } }, { firstName: 1, role: 1 }).lean();
  const actorById = new Map(actors.map((a) => [idOf(a), a]));
  return {
    salons,
    clients,
    bookings30d,
    revenue30d: revenue[0]?.total ?? 0,
    pendingSalons: pending.map((s) => ({ id: s.id, name: s.name, city: s.city, owner: s.owner })),
    openReports,
    plans: plans.map((p) => ({ plan: p._id, count: p.count })),
    audit: audit.map((entry) => {
      const actor = entry.actor ? actorById.get(entry.actor.toString()) : null;
      return {
        id: idOf(entry),
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        meta: entry.meta as Record<string, unknown> | null,
        createdAt: entry.createdAt,
        actor: actor ? { firstName: actor.firstName, role: actor.role } : null,
        minutesAgo: Math.max(1, Math.round((now.getTime() - entry.createdAt.getTime()) / 60_000)),
      };
    }),
  };
}

/** Files de travail du Super Admin : salons à valider (ADM-02) et avis signalés à modérer (AVI-06) */
export async function adminQueues(now = new Date()) {
  const [pending, reports] = await Promise.all([pendingSalons(), ReviewReport.find({ status: "OPEN" }).sort({ createdAt: 1 }).lean()]);
  const reviews = await Review.find({ _id: { $in: reports.map((r) => r.review) } }).lean();
  const [salons, clients] = await Promise.all([
    Salon.find({ _id: { $in: reviews.map((r) => r.salon) } }, { name: 1 }).lean(),
    User.find({ _id: { $in: reviews.map((r) => r.client) } }, { firstName: 1, lastName: 1 }).lean(),
  ]);
  const reviewById = new Map(reviews.map((r) => [idOf(r), r]));
  const salonById = new Map(salons.map((s) => [idOf(s), s]));
  const clientById = new Map(clients.map((c) => [idOf(c), c]));

  const grouped = groupFlagged(
    reports.flatMap((report) => {
      const r = reviewById.get(report.review.toString());
      if (!r) return [];
      const client = clientById.get(r.client.toString());
      return [
        {
          source: report.source,
          reason: report.reason,
          review: {
            id: idOf(r),
            salon: salonById.get(r.salon.toString())?.name ?? "",
            author: shortName(client?.firstName ?? "", client?.lastName ?? ""),
            rating: r.rating,
            text: r.text,
            lang: r.lang,
            score: r.suspicion ?? 0,
          },
        },
      ];
    })
  );

  return {
    pending: pending.map((s) => ({
      id: s.id,
      name: s.name,
      owner: fullName(s.owner),
      city: s.city,
      category: CATEGORY_LABEL[s.category] ?? s.category,
      plan: s.plan,
      hoursAgo: Math.max(0, Math.round((now.getTime() - s.createdAt.getTime()) / 3_600_000)),
      document: s.documentUrl ?? "—",
    })),
    flagged: grouped,
  };
}

export type PendingSalonRow = Awaited<ReturnType<typeof adminQueues>>["pending"][number];
