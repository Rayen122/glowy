import { OutboxMessage } from "@/infrastructure/db";
import type { Mailer, SmsSender } from "../application/ports";

/**
 * Démo : e-mails et SMS simulés (cahier §1.4). Ils sont écrits dans le journal serveur et gardés dans la
 * boîte d'envoi (collection outboxmessages, page Super Admin « Messages envoyés »).
 * Pour envoyer de vrais messages, brancher Resend / Nodemailer et un fournisseur SMS ici (cahier §6).
 */
const silent = process.env.NODE_ENV === "test";

export const consoleMailer: Mailer = {
  send: async (to, subject, text) => {
    if (!silent) console.info(`[email simulé] à ${to} — ${subject}\n${text}`);
    await OutboxMessage.create({ channel: "email", to, subject, text });
  },
};

export const consoleSms: SmsSender = {
  send: async (phone, text) => {
    if (!silent) console.info(`[SMS simulé] à ${phone} — ${text}`);
    await OutboxMessage.create({ channel: "sms", to: phone, text });
  },
};

/** Derniers messages simulés (page Super Admin) */
export async function latestOutbox(take = 100) {
  return (await OutboxMessage.find().sort({ createdAt: -1 }).limit(take).lean()).map((m) => ({
    id: m._id.toString(),
    channel: m.channel as "email" | "sms",
    to: m.to,
    subject: m.subject,
    text: m.text,
    createdAt: m.createdAt,
  }));
}
