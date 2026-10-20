import type { Actor } from "@/core/domain/actor";
import { badRequest, conflict, notFound } from "@/core/domain/errors";
import { toMinutes, utcToTunis } from "@/core/domain/time";
import { idOf, isDuplicateKey, objectId, QueueEntry, Salon, User } from "@/infrastructure/db";
import type { QueueAction } from "../application/schemas";
import { waitContext } from "./mongo-affluence";

/**
 * RES-08 : file d'attente virtuelle. La cliente prend place depuis la page du salon (ouvert), suit sa position
 * et son attente estimée en direct ; l'équipe appelle, sert ou retire les personnes depuis le dashboard.
 */

type Notifier = (userId: string, message: { type: string; title: string; body: string; link?: string }) => Promise<unknown>;

const OPEN_STATUSES = ["WAITING", "CALLED"] as const;

async function openSalon(slug: string, now: Date) {
  const salon = await Salon.findOne({ slug, status: "ACTIVE" }, { name: 1, openingHours: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  const t = utcToTunis(now);
  const hours = salon.openingHours.find((o) => o.weekday === t.weekday);
  const open = Boolean(hours?.opensAt && hours.closesAt && toMinutes(t.time) >= toMinutes(hours.opensAt) && toMinutes(t.time) < toMinutes(hours.closesAt) - 30);
  return { salon, open };
}

/** Positions et attentes estimées des personnes en attente, dans l'ordre d'arrivée */
async function waitingLine(salonId: string, now: Date) {
  const [entries, ctx] = await Promise.all([QueueEntry.find({ salon: objectId(salonId), status: "WAITING" }).sort({ createdAt: 1 }).lean(), waitContext(salonId, now)]);
  return entries.map((e, i) => ({ entry: e, position: i + 1, waitMinutes: ctx.waitAt(i + 1) }));
}

export async function joinQueue(userId: string, slug: string, service: string | undefined, now = new Date()) {
  const { salon, open } = await openSalon(slug, now);
  if (!open) throw badRequest("QUEUE_CLOSED", "La file d'attente est ouverte pendant les horaires du salon.");
  const user = await User.findById(objectId(userId), { firstName: 1, lastName: 1 }).lean();
  try {
    await QueueEntry.create({ salon: salon._id, client: objectId(userId), name: `${user?.firstName ?? ""} ${(user?.lastName ?? "").charAt(0)}.`.trim(), service: service || null });
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict("ALREADY_IN_QUEUE", "Vous êtes déjà dans la file de ce salon.");
    throw error;
  }
  return myQueueStatus(userId, slug, now);
}

export async function leaveQueue(userId: string, slug: string, now = new Date()) {
  const salon = await Salon.findOne({ slug }, { _id: 1 }).lean();
  const left = salon ? await QueueEntry.findOneAndUpdate({ salon: salon._id, client: objectId(userId), status: { $in: OPEN_STATUSES } }, { $set: { status: "LEFT", closedAt: now } }).lean() : null;
  if (!left) throw notFound("Vous n'êtes pas dans la file de ce salon.");
  return { left: true };
}

/** Place de la cliente dans la file (null si elle n'y est pas) */
export async function myQueueStatus(userId: string | null, slug: string, now = new Date()) {
  const salon = await Salon.findOne({ slug }, { _id: 1 }).lean();
  if (!salon || !userId) return null;
  const mine = await QueueEntry.findOne({ salon: salon._id, client: objectId(userId), status: { $in: OPEN_STATUSES } }).lean();
  if (!mine) return null;
  if (mine.status === "CALLED") return { id: idOf(mine), status: "CALLED" as const, position: 0, waitMinutes: 0 };
  const line = await waitingLine(String(salon._id), now);
  const me = line.find((l) => l.entry._id.equals(mine._id));
  return { id: idOf(mine), status: "WAITING" as const, position: me?.position ?? 1, waitMinutes: me?.waitMinutes ?? 0 };
}

export async function salonOpenNow(slug: string, now = new Date()) {
  return (await openSalon(slug, now)).open;
}

/** Tableau de bord : personnes appelées puis en attente, avec attente estimée */
export async function salonQueue(salonId: string, now = new Date()) {
  const [line, called] = await Promise.all([waitingLine(salonId, now), QueueEntry.find({ salon: objectId(salonId), status: "CALLED" }).sort({ calledAt: 1 }).lean()]);
  const row = (e: (typeof called)[number]) => ({ id: idOf(e), name: e.name, service: e.service ?? null, client: Boolean(e.client), since: utcToTunis(e.createdAt).time, waitedMinutes: Math.max(0, Math.round((now.getTime() - e.createdAt.getTime()) / 60_000)) });
  return {
    called: called.map((e) => ({ ...row(e), status: "CALLED" as const })),
    waiting: line.map((l) => ({ ...row(l.entry), status: "WAITING" as const, position: l.position, waitMinutes: l.waitMinutes })),
  };
}

export type SalonQueue = Awaited<ReturnType<typeof salonQueue>>;

export async function addWalkIn(salonId: string, name: string, service: string | undefined) {
  const entry = await QueueEntry.create({ salon: objectId(salonId)!, client: null, name, service: service || null });
  return { id: idOf(entry) };
}

type QueueStatus = "WAITING" | "CALLED" | "SERVED" | "LEFT" | "NO_SHOW";

const NEXT: Record<QueueAction, { from: QueueStatus[]; to: QueueStatus }> = {
  call: { from: ["WAITING"], to: "CALLED" },
  serve: { from: ["WAITING", "CALLED"], to: "SERVED" },
  noShow: { from: ["CALLED", "WAITING"], to: "NO_SHOW" },
  remove: { from: ["WAITING", "CALLED"], to: "LEFT" },
};

/** Action de l'équipe ; « appeler » prévient la cliente (notification) */
export async function queueAction(actor: Actor, salonId: string, entryId: string, action: QueueAction, notify: Notifier, now = new Date()) {
  const rule = NEXT[action];
  const closing = rule.to !== "CALLED";
  const updated = await QueueEntry.findOneAndUpdate(
    { _id: objectId(entryId)!, salon: objectId(salonId)!, status: { $in: rule.from } },
    { $set: { status: rule.to, ...(closing ? { closedAt: now } : { calledAt: now }) } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) throw notFound("Personne introuvable dans la file.");
  if (action === "call" && updated.client) {
    const salon = await Salon.findById(updated.salon, { name: 1, slug: 1 }).lean();
    await notify(String(updated.client), { type: "queue.called", title: "C'est à vous !", body: `${salon?.name ?? "Le salon"} vous attend : présentez-vous à l'accueil.`, link: salon ? `/salons/${salon.slug}` : undefined });
  }
  return { id: entryId, status: updated.status, by: actor.id };
}
