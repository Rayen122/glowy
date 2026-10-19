import type { Actor } from "@/core/domain/actor";
import { notFound } from "@/core/domain/errors";
import { utcToTunis } from "@/core/domain/time";
import { Booking, ClientNote, Employee, idOf, objectId, User } from "@/infrastructure/db";
import type { ClientNoteInput } from "../application/schemas";
import { currentSalonId } from "./current-salon";

/** SAL-08 : mini-CRM — uniquement les clientes qui ont déjà réservé dans ce salon */

export const CRM_FILTERS = ["all", "inactive", "new", "loyal"] as const;
export type CrmFilter = (typeof CRM_FILTERS)[number];
/** Inactive : pas de visite depuis 60 jours */
const INACTIVE_DAYS = 60;
const PAGE = 30;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function listSalonClients(salonId: string, params: { q?: string; filter?: CrmFilter; page?: number }, now = new Date()) {
  const salon = objectId(salonId)!;
  const rows = await Booking.aggregate<{ _id: unknown; visits: number; spent: number; lastVisit: Date | null; firstVisit: Date; noShows: number; upcoming: number }>([
    { $match: { salon, status: { $ne: "CANCELLED" } } },
    {
      $group: {
        _id: "$client",
        visits: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
        spent: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$totalPrice", 0] } },
        lastVisit: { $max: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$startsAt", null] } },
        firstVisit: { $min: "$startsAt" },
        noShows: { $sum: { $cond: [{ $eq: ["$status", "NO_SHOW"] }, 1, 0] } },
        upcoming: { $sum: { $cond: [{ $and: [{ $in: ["$status", ["PENDING", "CONFIRMED"]] }, { $gt: ["$startsAt", now] }] }, 1, 0] } },
      },
    },
  ]);
  const users = await User.find(
    { _id: { $in: rows.map((r) => r._id) }, ...(params.q?.trim() ? { $or: ["firstName", "lastName", "email", "phone"].map((f) => ({ [f]: { $regex: escapeRegex(params.q!.trim()), $options: "i" } })) } : {}) },
    { firstName: 1, lastName: 1, email: 1, phone: 1 }
  ).lean();
  const inactiveSince = now.getTime() - INACTIVE_DAYS * 86_400_000;
  const all = users
    .map((u) => {
      const r = rows.find((x) => String(x._id) === idOf(u))!;
      return {
        id: idOf(u),
        name: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        phone: u.phone ?? null,
        visits: r.visits,
        spent: r.spent,
        lastVisit: r.lastVisit ? utcToTunis(r.lastVisit).date : null,
        firstVisit: utcToTunis(r.firstVisit).date,
        noShows: r.noShows,
        upcoming: r.upcoming,
        inactive: r.upcoming === 0 && (!r.lastVisit || r.lastVisit.getTime() < inactiveSince),
        isNew: r.visits <= 1,
      };
    })
    .sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));
  const counts = { all: all.length, inactive: all.filter((c) => c.inactive).length, new: all.filter((c) => c.isNew).length, loyal: all.filter((c) => c.visits >= 5).length };
  const filtered = all.filter((c) => (params.filter === "inactive" ? c.inactive : params.filter === "new" ? c.isNew : params.filter === "loyal" ? c.visits >= 5 : true));
  const page = Math.max(1, params.page ?? 1);
  return { counts, page, pages: Math.max(1, Math.ceil(filtered.length / PAGE)), rows: filtered.slice((page - 1) * PAGE, page * PAGE) };
}

export type SalonClientRow = Awaited<ReturnType<typeof listSalonClients>>["rows"][number];

/** Fiche cliente : coordonnées, historique dans le salon, notes */
export async function salonClientCard(salonId: string, clientId: string) {
  const salon = objectId(salonId)!;
  const client = objectId(clientId);
  const bookings = client ? await Booking.find({ salon, client }).sort({ startsAt: -1 }).lean() : [];
  if (!bookings.length) throw notFound("Cliente introuvable dans ce salon.");
  const [user, employees, notes] = await Promise.all([
    User.findById(client, { firstName: 1, lastName: 1, email: 1, phone: 1, birthDate: 1, avatarUrl: 1 }).lean(),
    Employee.find({ salon }, { name: 1 }).lean(),
    ClientNote.find({ salon, client }).sort({ createdAt: -1 }).lean(),
  ]);
  if (!user) throw notFound("Cliente introuvable.");
  const authors = await User.find({ _id: { $in: notes.map((n) => n.author).filter(Boolean) } }, { firstName: 1 }).lean();
  const completed = bookings.filter((b) => b.status === "COMPLETED");
  return {
    id: clientId,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    phone: user.phone ?? null,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    avatarUrl: user.avatarUrl ?? null,
    visits: completed.length,
    spent: completed.reduce((a, b) => a + b.totalPrice, 0),
    noShows: bookings.filter((b) => b.status === "NO_SHOW").length,
    cancellations: bookings.filter((b) => b.status === "CANCELLED").length,
    favoriteService: Object.entries(completed.flatMap((b) => b.items.map((i) => i.name ?? "")).reduce<Record<string, number>>((acc, n) => ({ ...acc, [n]: (acc[n] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    history: bookings.map((b) => ({
      id: idOf(b),
      date: utcToTunis(b.startsAt).date,
      time: utcToTunis(b.startsAt).time,
      service: b.items.map((i) => i.name).join(" + "),
      employee: employees.find((e) => e._id.equals(b.employee))?.name ?? "",
      status: b.status,
      price: b.totalPrice,
    })),
    notes: notes.map((n) => ({ id: idOf(n), kind: n.kind as "allergy" | "preference" | "note", text: n.text, createdAt: n.createdAt, author: authors.find((a) => n.author && a._id.equals(n.author))?.firstName ?? null })),
  };
}

export type SalonClientCard = Awaited<ReturnType<typeof salonClientCard>>;

export async function addClientNote(actor: Actor, clientId: string, input: ClientNoteInput) {
  const salon = objectId(await currentSalonId(actor))!;
  const client = objectId(clientId);
  if (!client || !(await Booking.exists({ salon, client }))) throw notFound("Cliente introuvable dans ce salon.");
  const note = await ClientNote.create({ salon, client, author: objectId(actor.id), ...input });
  return { id: idOf(note) };
}

export async function deleteClientNote(actor: Actor, noteId: string) {
  const salon = objectId(await currentSalonId(actor))!;
  const _id = objectId(noteId);
  const result = _id ? await ClientNote.deleteOne({ _id, salon }) : null;
  if (!result?.deletedCount) throw notFound("Note introuvable.");
  return { id: noteId };
}
