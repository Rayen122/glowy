import { OutboxMessage } from "@/infrastructure/db";
import type { Mailer, SmsSender } from "../application/ports";
import { sendSmtp, smtpEnabled } from "./smtp-mailer";

/**
 * Canaux e-mail et SMS. Chaque message est gardé dans la boîte d'envoi (collection outboxmessages,
 * page Super Admin « Messages envoyés »).
 *  - E-mail : envoi réel par SMTP quand il est configuré (.env), sinon simulé (cahier §1.4) et écrit dans le journal serveur.
 *  - SMS : toujours simulé (brancher un fournisseur SMS ici).
 */
const silent = process.env.NODE_ENV === "test";

/** Une fois l'e-mail réellement parti, ses liens secrets (réinitialisation, vérification) ne restent pas lisibles par l'admin */
const redactTokens = (text: string) => text.replace(/([?&]token=)[^\s&]+/g, "$1•••");

export const emailIsSimulated = () => !smtpEnabled();

export const emailChannel: Mailer = {
  send: async (to, subject, text) => {
    if (!smtpEnabled()) {
      if (!silent) console.info(`[email simulé] à ${to} — ${subject}\n${text}`);
      await OutboxMessage.create({ channel: "email", to, subject, text, delivery: "simulated" });
      return;
    }
    let delivery: "sent" | "failed" = "sent";
    try {
      await sendSmtp(to, subject, text);
    } catch (error) {
      delivery = "failed";
      console.error(`[email] échec de l'envoi à ${to} — ${subject}`, error);
    }
    await OutboxMessage.create({ channel: "email", to, subject, text: redactTokens(text), delivery });
  },
};

export const consoleSms: SmsSender = {
  send: async (phone, text) => {
    if (!silent) console.info(`[SMS simulé] à ${phone} — ${text}`);
    await OutboxMessage.create({ channel: "sms", to: phone, text });
  },
};

/** Derniers messages (page Super Admin) */
export async function latestOutbox(take = 100) {
  return (await OutboxMessage.find().sort({ createdAt: -1 }).limit(take).lean()).map((m) => ({
    id: m._id.toString(),
    channel: m.channel as "email" | "sms",
    to: m.to,
    subject: m.subject,
    text: m.text,
    delivery: (m.delivery ?? "simulated") as "simulated" | "sent" | "failed",
    createdAt: m.createdAt,
  }));
}
