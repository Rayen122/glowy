import { Announcement, AuditLog, idOf, Notification, objectId, User } from "@/infrastructure/db";
import type { AnnouncementInput } from "../application/schemas";

const AUDIENCE_ROLES = { ALL: ["CLIENT", "MANAGER", "EMPLOYEE"], CLIENTS: ["CLIENT"], SALONS: ["MANAGER", "EMPLOYEE"] } as const;

/** ADM-10 : annonce publiée en notification dans l'application de chaque destinataire actif */
export async function sendAnnouncement(actorId: string, input: AnnouncementInput) {
  const users = await User.find({ role: { $in: AUDIENCE_ROLES[input.audience] }, status: "ACTIVE" }, { _id: 1 }).lean();
  const BATCH = 500;
  for (let i = 0; i < users.length; i += BATCH) {
    await Notification.insertMany(users.slice(i, i + BATCH).map((u) => ({ user: u._id, type: "announcement", title: input.title, body: input.body, link: input.link })), { ordered: false });
  }
  const announcement = await Announcement.create({ ...input, recipients: users.length, createdBy: objectId(actorId)! });
  await AuditLog.create({ actor: objectId(actorId), action: "platform.announcement", targetType: "Announcement", targetId: idOf(announcement), meta: { name: input.title, audience: input.audience } });
  return { id: idOf(announcement), recipients: users.length };
}

export async function listAnnouncements(take = 20) {
  return (await Announcement.find().sort({ createdAt: -1 }).limit(take).lean()).map((a) => ({
    id: idOf(a),
    title: a.title,
    body: a.body,
    audience: a.audience as AnnouncementInput["audience"],
    link: a.link ?? null,
    recipients: a.recipients,
    createdAt: a.createdAt,
  }));
}
