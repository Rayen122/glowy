import type { Actor } from "@/core/domain/actor";
import { forbidden } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { slugify } from "@/core/domain/text";
import { tunisDayRange, tunisToday } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Salon } from "@/infrastructure/db";
import type { BranchInput } from "../application/schemas";
import { currentSalonId } from "./current-salon";

/**
 * SAL-14 (bonus) : plusieurs succursales pour un même gérant. Chaque succursale est un salon à part entière
 * (agenda, équipe, caisse…) ; le gérant choisit celle qu'il pilote (cookie) et voit l'ensemble sur une page.
 * Une nouvelle succursale reprend prestations, horaires et règles du salon courant et attend la validation
 * du Super Admin (ADM-02), comme toute inscription.
 */

export async function listBranches(actor: Actor, now = new Date()) {
  if (actor.role !== "MANAGER") throw forbidden();
  const owner = objectId(actor.id);
  const [salons, current] = await Promise.all([Salon.find({ owner }, { name: 1, slug: 1, city: 1, status: 1, plan: 1, coverUrl: 1 }).sort({ createdAt: 1 }).lean(), currentSalonId(actor)]);
  const ids = salons.map((s) => s._id);
  const today = tunisDayRange(tunisToday(now));
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [todayCounts, revenue, team] = await Promise.all([
    Booking.aggregate<{ _id: unknown; n: number }>([{ $match: { salon: { $in: ids }, startsAt: { $gte: today.start, $lt: today.end }, status: { $nin: ["CANCELLED"] } } }, { $group: { _id: "$salon", n: { $sum: 1 } } }]),
    Booking.aggregate<{ _id: unknown; total: number }>([{ $match: { salon: { $in: ids }, status: "COMPLETED", startsAt: { $gte: since, $lt: now } } }, { $group: { _id: "$salon", total: { $sum: "$totalPrice" } } }]),
    Employee.aggregate<{ _id: unknown; n: number }>([{ $match: { salon: { $in: ids }, active: true } }, { $group: { _id: "$salon", n: { $sum: 1 } } }]),
  ]);
  const of = <T extends { _id: unknown }>(rows: T[], id: unknown) => rows.find((r) => String(r._id) === String(id));
  return salons.map((s) => ({
    id: idOf(s),
    slug: s.slug,
    name: s.name,
    city: s.city,
    status: s.status as "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED",
    plan: s.plan,
    coverUrl: s.coverUrl ?? null,
    current: idOf(s) === current,
    today: of(todayCounts, s._id)?.n ?? 0,
    revenue30d: of(revenue, s._id)?.total ?? 0,
    team: of(team, s._id)?.n ?? 0,
  }));
}

export type Branch = Awaited<ReturnType<typeof listBranches>>[number];

/** Le gérant choisit la succursale à piloter : uniquement l'un de ses salons */
export async function assertOwnBranch(actor: Actor, salonId: string) {
  if (actor.role !== "MANAGER" || !(await Salon.exists({ _id: objectId(salonId), owner: objectId(actor.id) }))) throw forbidden("Ce salon ne vous appartient pas.");
  return salonId;
}

async function uniqueSlug(base: string) {
  const root = slugify(base) || "salon";
  for (let i = 0; ; i++) {
    const slug = i ? `${root}-${i + 1}` : root;
    if (!(await Salon.exists({ slug }))) return slug;
  }
}

export async function createBranch(actor: Actor, input: BranchInput, events: EventPublisher) {
  if (actor.role !== "MANAGER") throw forbidden();
  const source = await Salon.findById(objectId(await currentSalonId(actor))).lean();
  if (!source) throw forbidden();
  const branch = await Salon.create({
    slug: await uniqueSlug(`${input.name} ${input.city}`),
    name: input.name,
    category: source.category,
    specialties: source.specialties,
    description: source.description ?? null,
    city: input.city,
    address: input.address,
    phone: input.phone ?? source.phone ?? null,
    lat: source.lat,
    lng: source.lng,
    status: "PENDING",
    verified: false,
    plan: "gratuit",
    owner: objectId(actor.id)!,
    depositAmount: source.depositAmount,
    cancellationHours: source.cancellationHours,
    openingHours: source.openingHours,
    services: source.services,
  });
  await events.publish("salon.registered", { salonId: idOf(branch), ownerId: actor.id, plan: "gratuit" });
  return { id: idOf(branch), slug: branch.slug };
}
