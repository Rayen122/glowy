/**
 * Farhty : invitations de mariage et d'événements (site partenaire), affiché dans la page /invitations.
 * `FARHTY_URL` permet de pointer vers une copie locale de Farhty pendant le développement.
 */
export const FARHTY_URL = (process.env.FARHTY_URL ?? "https://www.farhty.me").replace(/\/+$/, "");
export const FARHTY_ORIGIN = new URL(FARHTY_URL).origin;
