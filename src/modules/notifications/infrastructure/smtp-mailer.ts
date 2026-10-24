import nodemailer, { type Transporter } from "nodemailer";

/**
 * Envoi réel des e-mails par SMTP (Gmail, Outlook, Brevo, Mailtrap…), actif dès que SMTP_HOST est renseigné
 * dans .env (voir .env.example). Jamais pendant les tests automatisés.
 */
export const smtpEnabled = () => process.env.NODE_ENV !== "test" && Boolean(process.env.SMTP_HOST?.trim());

let transport: Transporter | undefined;

function smtpTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!.trim(),
    port,
    // 465 : TLS direct ; 587 / 25 : STARTTLS
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 10_000,
  });
  return transport;
}

const sender = () => process.env.MAIL_FROM?.trim() || `Glowy <${process.env.SMTP_USER?.trim()}>`;

export async function sendSmtp(to: string, subject: string, text: string) {
  await smtpTransport().sendMail({ from: sender(), to, subject, text, html: emailHtml(subject, text) });
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const linkify = (escaped: string) => escaped.replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#6B2A5C">${url}</a>`);

const isUrl = (line: string) => /^https?:\/\/\S+$/.test(line);

const button = (url: string) => `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#6B2A5C;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px">Ouvrir le lien</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#8a7a85;word-break:break-all">${linkify(url)}</p>`;

/** Version HTML aux couleurs de Glowy : un paragraphe par bloc ; un lien seul en fin de paragraphe devient un bouton */
export function emailHtml(subject: string, text: string) {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim());
      const url = isUrl(lines.at(-1)!) ? escapeHtml(lines.pop()!) : null;
      const paragraph = lines.length ? `<p style="margin:0 0 16px">${lines.map((line) => linkify(escapeHtml(line))).join("<br>")}</p>` : "";
      return paragraph + (url ? button(url) : "");
    })
    .join("\n");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#FBF7F4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b1a26;line-height:1.55">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
<p style="margin:0 0 20px;font-size:22px;font-weight:700;color:#6B2A5C">Glowy</p>
<div style="background:#ffffff;border-radius:20px;padding:28px 24px;border:1px solid #efe6ea">${blocks}</div>
<p style="margin:20px 0 0;font-size:12px;color:#8a7a85;text-align:center">Glowy · Réservation beauté en Tunisie</p>
</div></body></html>`;
}
