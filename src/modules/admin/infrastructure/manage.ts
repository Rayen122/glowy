import type { Role } from "@/core/domain/actor";
import type { SalonStatus, UserStatus } from "@/core/domain/enums";
import { notFound } from "@/core/domain/errors";
import { AuditLog, Booking, Employee, idOf, objectId, Review, ReviewReport, Salon, User } from "@/infrastructure/db";
import { requestPasswordReset } from "@/modules/identity";

/** Écrans de gestion du Super Admin : salons (ADM-03), utilisateurs (ADM-04), journal (ADM-07), croissance (ADM-01) */

export const PAGE_SIZE = 25;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const search = (q: string | undefined, fields: string[]) => (q?.trim() ? { $or: fields.map((f) => ({ [f]: { $regex: escapeRegex(q.trim()), $options: "i" } })) } : {});

export async function listSalonsForAdmin(params: { q?: string; status?: SalonStatus; page?: number }, now = new Date()) {
  const filter = { ...search(params.q, ["name", "city", "slug"]), ...(params.status ? { status: params.status } : {}) };
  const page = Math.max(1, params.page ?? 1);
  const [total, salons] = await Promise.all([
    Salon.countDocuments(filter),
    Salon.find(filter, { slug: 1, name: 1, city: 1, category: 1, plan: 1, status: 1, verified: 1, owner: 1, ratingAvg: 1, reviewCount: 1, createdAt: 1, documentUrl: 1 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ]);
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [owners, activity, counts] = await Promise.all([
    User.find({ _id: { $in: salons.map((s) => s.owner) } }, { firstName: 1, lastName: 1, email: 1 }).lean(),
    Booking.aggregate<{ _id: unknown; count: number }>([{ $match: { salon: { $in: salons.map((s) => s._id) }, startsAt: { $gte: since } } }, { $group: { _id: "$salon", count: { $sum: 1 } } }]),
    Salon.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const ownerById = new Map(owners.map((o) => [idOf(o), o]));
  const activityBy = new Map(activity.map((a) => [String(a._id), a.count]));
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) as Partial<Record<SalonStatus, number>>,
    rows: salons.map((s) => {
      const owner = ownerById.get(s.owner.toString());
      return {
        id: idOf(s),
        slug: s.slug,
        name: s.name,
        city: s.city,
        category: s.category,
        plan: s.plan,
        status: s.status,
        verified: s.verified,
        rating: s.ratingAvg,
        reviewCount: s.reviewCount,
        bookings30d: activityBy.get(idOf(s)) ?? 0,
        owner: owner ? { name: `${owner.firstName} ${owner.lastName}`.trim(), email: owner.email } : null,
        documentUrl: s.documentUrl ?? null,
        createdAt: s.createdAt,
      };
    }),
  };
}

export type AdminSalonRow = Awaited<ReturnType<typeof listSalonsForAdmin>>["rows"][number];

export async function listUsersForAdmin(params: { q?: string; role?: Role; status?: UserStatus; page?: number }, now = new Date()) {
  const filter = { ...search(params.q, ["email", "firstName", "lastName"]), ...(params.role ? { role: params.role } : {}), ...(params.status ? { status: params.status } : {}) };
  const page = Math.max(1, params.page ?? 1);
  const [total, users, counts] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, { email: 1, firstName: 1, lastName: 1, role: 1, status: 1, createdAt: 1, lockedUntil: 1, emailVerified: 1, loyalty: 1 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
  ]);
  const ids = users.map((u) => u._id);
  const [owned, employees] = await Promise.all([Salon.find({ owner: { $in: ids } }, { name: 1, owner: 1 }).lean(), Employee.find({ user: { $in: ids } }, { user: 1, salon: 1 }).lean()]);
  const employerSalons = await Salon.find({ _id: { $in: employees.map((e) => e.salon) } }, { name: 1 }).lean();
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) as Partial<Record<Role, number>>,
    rows: users.map((u) => {
      const salon = owned.find((s) => s.owner.equals(u._id)) ?? employerSalons.find((s) => employees.some((e) => e.user?.equals(u._id) && e.salon.equals(s._id)));
      return {
        id: idOf(u),
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        role: u.role,
        status: u.status,
        locked: Boolean(u.lockedUntil && u.lockedUntil > now),
        emailVerified: Boolean(u.emailVerified),
        points: u.loyalty?.balance ?? 0,
        salon: salon?.name ?? null,
        createdAt: u.createdAt,
      };
    }),
  };
}

export type AdminUserRow = Awaited<ReturnType<typeof listUsersForAdmin>>["rows"][number];

/** ADM-07 : journal complet, filtrable par type d'action (préfixe : salon, user, review, plan…) */
export async function auditTrail(params: { kind?: string; page?: number }, now = new Date()) {
  const filter = params.kind ? { action: { $regex: `^${escapeRegex(params.kind)}\\.` } } : {};
  const page = Math.max(1, params.page ?? 1);
  const [total, entries, kinds] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    AuditLog.distinct("action"),
  ]);
  const actors = await User.find({ _id: { $in: entries.map((e) => e.actor).filter(Boolean) } }, { firstName: 1, lastName: 1, role: 1, email: 1 }).lean();
  const actorById = new Map(actors.map((a) => [idOf(a), a]));
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    kinds: [...new Set(kinds.map((k) => String(k).split(".")[0]))].sort(),
    rows: entries.map((e) => {
      const actor = e.actor ? actorById.get(e.actor.toString()) : null;
      return {
        id: idOf(e),
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId ?? null,
        meta: (e.meta ?? null) as Record<string, unknown> | null,
        createdAt: e.createdAt,
        minutesAgo: Math.max(1, Math.round((now.getTime() - e.createdAt.getTime()) / 60_000)),
        actor: actor ? { name: `${actor.firstName} ${actor.lastName}`.trim(), role: actor.role, email: actor.email } : null,
      };
    }),
  };
}

/** ADM-01 : croissance sur 12 mois (rendez-vous, chiffre d'affaires des rendez-vous terminés, nouveaux comptes, nouveaux salons) */
export async function platformGrowth(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const month = { $dateToString: { date: "$d", format: "%Y-%m-01", timezone: "Africa/Tunis" } };
  const [bookings, users, salons] = await Promise.all([
    Booking.aggregate<{ _id: string; count: number; revenue: number }>([
      { $match: { startsAt: { $gte: start, $lte: now } } },
      { $addFields: { d: "$startsAt" } },
      { $group: { _id: month, count: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalPrice", 0] } } } },
    ]),
    User.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: start } } }, { $addFields: { d: "$createdAt" } }, { $group: { _id: month, count: { $sum: 1 } } }]),
    Salon.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: start } } }, { $addFields: { d: "$createdAt" } }, { $group: { _id: month, count: { $sum: 1 } } }]),
  ]);
  return Array.from({ length: 12 }, (_, i) => {
    const key = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 10);
    const b = bookings.find((x) => x._id === key);
    return { month: key, bookings: b?.count ?? 0, revenue: b?.revenue ?? 0, users: users.find((x) => x._id === key)?.count ?? 0, salons: salons.find((x) => x._id === key)?.count ?? 0 };
  });
}

/** ADM-04 : le Super Admin envoie un lien de réinitialisation du mot de passe, action journalisée */
export async function sendPasswordResetFor(adminId: string, userId: string, origin: string) {
  const _id = objectId(userId);
  const user = _id ? await User.findById(_id, { email: 1 }).lean() : null;
  if (!user) throw notFound("Utilisateur introuvable.");
  await requestPasswordReset(user.email, origin);
  await AuditLog.create({ actor: objectId(adminId), action: "user.passwordReset", targetType: "User", targetId: userId, meta: { email: user.email } });
  return { sent: true };
}

export async function salonExists(salonId: string) {
  const _id = objectId(salonId);
  return Boolean(_id && (await Salon.exists({ _id })));
}

/** AVI-06 : dernières décisions de modération (avis conservés ou masqués) */
export async function moderationHistory(take = 30) {
  const reports = await ReviewReport.find({ status: { $ne: "OPEN" } }).sort({ resolvedAt: -1 }).limit(take).lean();
  const [reviews, admins] = await Promise.all([
    Review.find({ _id: { $in: reports.map((r) => r.review) } }, { text: 1, rating: 1, salon: 1 }).lean(),
    User.find({ _id: { $in: reports.map((r) => r.resolvedBy).filter(Boolean) } }, { firstName: 1 }).lean(),
  ]);
  const salons = await Salon.find({ _id: { $in: reviews.map((r) => r.salon) } }, { name: 1 }).lean();
  return reports.map((r) => {
    const review = reviews.find((x) => x._id.equals(r.review));
    return {
      id: idOf(r),
      decision: r.status as "KEPT" | "HIDDEN",
      reason: r.reason,
      resolvedAt: r.resolvedAt ?? r.createdAt,
      by: admins.find((a) => r.resolvedBy && a._id.equals(r.resolvedBy))?.firstName ?? null,
      salon: salons.find((s) => review && s._id.equals(review.salon))?.name ?? "—",
      rating: review?.rating ?? 0,
      text: review?.text ?? "",
    };
  });
}

/** ADM-01 / ADM-08 : rendez-vous par ville sur `days` jours (hors annulations) */
export async function bookingsByCity(days = 365, now = new Date()) {
  const since = new Date(now.getTime() - days * 86_400_000);
  return Booking.aggregate<{ city: string; bookings: number; revenue: number }>([
    { $match: { startsAt: { $gte: since, $lte: now }, status: { $ne: "CANCELLED" } } },
    { $lookup: { from: "salons", localField: "salon", foreignField: "_id", as: "s", pipeline: [{ $project: { city: 1 } }] } },
    { $unwind: "$s" },
    { $group: { _id: "$s.city", bookings: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalPrice", 0] } } } },
    { $sort: { bookings: -1 } },
    { $project: { _id: 0, city: "$_id", bookings: 1, revenue: 1 } },
  ]);
}
