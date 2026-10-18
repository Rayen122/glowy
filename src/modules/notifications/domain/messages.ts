/**
 * Textes des notifications (CLI-07). Fonctions pures : un événement métier → un message.
 * Démo : textes en français ; à terme, clé de traduction + paramètres selon la langue du destinataire.
 */
export type Message = { type: string; title: string; body: string; link?: string };

const SALON_STATUS_TEXT: Record<string, string> = {
  ACTIVE: "Votre salon est en ligne avec le badge « Salon vérifié ».",
  REJECTED: "Votre demande n'a pas été acceptée. Contactez le support pour en savoir plus.",
  SUSPENDED: "Votre salon est temporairement suspendu. Contactez le support.",
};

export const welcome = (): Message => ({
  type: "welcome",
  title: "Bienvenue sur Glowy",
  body: "Votre compte est prêt. Réservez votre premier rendez-vous !",
  link: "/salons",
});

export const salonPending = (salon: { name: string; city: string }): Message => ({
  type: "salon.pending",
  title: "Nouveau salon à valider",
  body: `${salon.name} (${salon.city}) attend votre validation.`,
  link: "/admin/salons",
});

/** null : changement de statut sans message pour le gérant */
export const salonStatusChanged = (salonName: string, status: string): Message | null =>
  SALON_STATUS_TEXT[status] ? { type: "salon.status", title: salonName, body: SALON_STATUS_TEXT[status], link: "/dashboard" } : null;

export const bookingConfirmed = (salonName: string, date: string, time: string): Message => ({
  type: "booking.confirmed",
  title: "Rendez-vous confirmé",
  body: `${salonName}, le ${date} à ${time}.`,
  link: "/compte/rendez-vous",
});

export const bookingReceived = (client: string, date: string, time: string): Message => ({
  type: "booking.new",
  title: "Nouveau rendez-vous",
  body: `${client} — ${date} à ${time}`,
  link: "/dashboard/agenda",
});

export const bookingCancelled = (salonName: string, date: string, recipient: "client" | "salon"): Message => ({
  type: "booking.cancelled",
  title: "Rendez-vous annulé",
  body: `${salonName} — ${date}`,
  link: recipient === "salon" ? "/dashboard/agenda" : "/compte/rendez-vous",
});

export const reviewReceived = (rating: number, text: string): Message => ({
  type: "review.new",
  title: "Nouvel avis",
  body: `${rating}/5 — ${text.slice(0, 80)}`,
  link: "/dashboard/avis",
});

export const pointsEarned = (points: number, body: string): Message => ({ type: "points", title: `+${points} points`, body, link: "/compte/fidelite" });

export const pushTest = (): Message => ({ type: "push.test", title: "Glowy", body: "Les notifications sont activées sur cet appareil.", link: "/compte" });
