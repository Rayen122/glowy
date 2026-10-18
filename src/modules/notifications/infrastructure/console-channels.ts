import type { Mailer, SmsSender } from "../application/ports";

/** Démo : e-mails et SMS simulés dans le journal serveur — brancher Resend / Nodemailer et un fournisseur SMS ici (cahier §6) */
const silent = process.env.NODE_ENV === "test";

export const consoleMailer: Mailer = {
  send: async (to, subject, text) => {
    if (!silent) console.info(`[email simulé] à ${to} — ${subject}\n${text}`);
  },
};

export const consoleSms: SmsSender = {
  send: async (phone, text) => {
    if (!silent) console.info(`[SMS simulé] à ${phone} — ${text}`);
  },
};
