import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import { idOf, objectId, Salon, SupportTicket, User } from "@/infrastructure/db";
import type { TicketInput } from "../application/schemas";

/**
 * AVI-07 (bonus) : tickets de support. Une cliente ou l'équipe d'un salon ouvre un ticket ; le Super Admin
 * répond depuis sa file (prioritaire : niveau Platine, salon Premium). Chaque réponse prévient l'autre partie.
 */

type Notifier = (userId: string, message: { type: string; title: string; body: string; link?: string }) => Promise<unknown>;

const PLATINUM = 1000;
const linkFor = (role: string, id: string) => (role === "CLIENT" ? `/compte/support?ticket=${id}` : `/dashboard/support?ticket=${id}`);

async function isPriority(actor: Actor, salonId: string | null) {
  if (actor.role === "CLIENT") return ((await User.findById(objectId(actor.id), { loyalty: 1 }).lean())?.loyalty?.lifetime ?? 0) >= PLATINUM;
  return salonId ? (await Salon.findById(objectId(salonId), { plan: 1 }).lean())?.plan === "premium" : false;
}

export async function openTicket(actor: Actor, salonId: string | null, input: TicketInput, notify: Notifier) {
  const now = new Date();
  const ticket = await SupportTicket.create({
    author: objectId(actor.id)!,
    salon: objectId(salonId),
    subject: input.subject,
    category: input.category,
    priority: await isPriority(actor, salonId),
    messages: [{ author: objectId(actor.id), fromSupport: false, text: input.text, at: now }],
    lastMessageAt: now,
  });
  const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }, { _id: 1 }).lean();
  for (const admin of admins) await notify(String(admin._id), { type: "support.new", title: "Nouveau ticket de support", body: input.subject, link: `/admin/support?ticket=${idOf(ticket)}` });
  return { id: idOf(ticket) };
}

const toSummary = (t: { _id: unknown; subject: string; category?: string | null; status: string; priority: boolean; lastMessageAt: Date; createdAt: Date; messages: unknown[] }) => ({
  id: String(t._id),
  subject: t.subject,
  category: (t.category ?? "other") as TicketInput["category"],
  status: t.status as "OPEN" | "ANSWERED" | "CLOSED",
  priority: t.priority,
  lastMessageAt: t.lastMessageAt,
  createdAt: t.createdAt,
  count: t.messages.length,
});

export async function myTickets(actor: Actor) {
  return (await SupportTicket.find({ author: objectId(actor.id) }).sort({ lastMessageAt: -1 }).limit(50).lean()).map(toSummary);
}

/** File du Super Admin : ouverts d'abord, prioritaires d'abord, plus anciens d'abord */
export async function supportQueue(filter: "open" | "all" = "open") {
  const tickets = await SupportTicket.find(filter === "open" ? { status: { $ne: "CLOSED" } } : {}).sort({ priority: -1, lastMessageAt: 1 }).limit(100).lean();
  const users = await User.find({ _id: { $in: tickets.map((t) => t.author) } }, { firstName: 1, lastName: 1, role: 1 }).lean();
  const salons = await Salon.find({ _id: { $in: tickets.map((t) => t.salon).filter(Boolean) } }, { name: 1 }).lean();
  return tickets.map((t) => {
    const u = users.find((x) => x._id.equals(t.author));
    return { ...toSummary(t), author: u ? `${u.firstName} ${u.lastName}`.trim() : "", role: u?.role ?? "CLIENT", salon: salons.find((s) => t.salon && s._id.equals(t.salon))?.name ?? null };
  });
}

export type SupportQueueRow = Awaited<ReturnType<typeof supportQueue>>[number];

/** Conversation : l'autrice du ticket ou le Super Admin */
export async function ticketThread(actor: Actor, id: string) {
  const ticket = await SupportTicket.findById(objectId(id)).lean();
  if (!ticket || (actor.role !== "ADMIN" && !ticket.author.equals(actor.id))) throw notFound("Ticket introuvable.");
  const users = await User.find({ _id: { $in: ticket.messages.map((m) => m.author).filter(Boolean) } }, { firstName: 1 }).lean();
  return {
    ...toSummary(ticket),
    messages: ticket.messages.map((m) => ({ fromSupport: Boolean(m.fromSupport), author: users.find((u) => m.author && u._id.equals(m.author))?.firstName ?? "", text: m.text ?? "", at: m.at ?? ticket.createdAt })),
  };
}

export type TicketThread = Awaited<ReturnType<typeof ticketThread>>;

export async function replyToTicket(actor: Actor, id: string, text: string, notify: Notifier) {
  const ticket = await SupportTicket.findById(objectId(id)).lean();
  const fromSupport = actor.role === "ADMIN";
  if (!ticket || (!fromSupport && !ticket.author.equals(actor.id))) throw notFound("Ticket introuvable.");
  if (ticket.status === "CLOSED" && !fromSupport) throw conflict("TICKET_CLOSED", "Ce ticket est fermé : rouvrez-le pour écrire.");
  const now = new Date();
  await SupportTicket.updateOne(
    { _id: ticket._id },
    { $push: { messages: { author: objectId(actor.id), fromSupport, text, at: now } }, $set: { lastMessageAt: now, status: fromSupport ? "ANSWERED" : "OPEN" } }
  );
  if (fromSupport) {
    const author = await User.findById(ticket.author, { role: 1 }).lean();
    await notify(String(ticket.author), { type: "support.reply", title: "Réponse du support Glowy", body: ticket.subject, link: linkFor(author?.role ?? "CLIENT", id) });
  }
  return ticketThread(actor, id);
}

export async function setTicketStatus(actor: Actor, id: string, status: "OPEN" | "CLOSED") {
  const ticket = await SupportTicket.findById(objectId(id)).lean();
  if (!ticket || (actor.role !== "ADMIN" && !ticket.author.equals(actor.id))) throw notFound("Ticket introuvable.");
  await SupportTicket.updateOne({ _id: ticket._id }, { $set: { status } });
  return { id, status };
}

/** Badge de la navigation du Super Admin */
export const openTicketsCount = () => SupportTicket.countDocuments({ status: "OPEN" });
