/**
 * Textes des notifications (CLI-07). Fonctions pures : un événement métier → un message.
 * Démo : textes en français ; à terme, clé de traduction + paramètres selon la langue du destinataire.
 */
export type Message = { type: string; title: string; body: string; link?: string };

/** « 2026-11-09 » → « lundi 9 novembre » : jamais de date brute dans un message */
const dayLabel = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : date;

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

const PLAN_LABEL: Record<string, string> = { pro: "Pro", premium: "Premium" };

/** Aux Super Admins : un paiement d'abonnement attend leur décision */
export const planPaymentRequested = (salonName: string, plan: string, amount: number): Message => ({
  type: "plan.requested",
  title: "Paiement à valider",
  body: `${salonName} : plan ${PLAN_LABEL[plan] ?? plan}, ${amount} DT.`,
  link: "/admin/abonnements",
});

/** Au gérant : décision du Super Admin sur son paiement */
export const planPaymentDecided = (plan: string, accepted: boolean, reason: string | null): Message => ({
  type: "plan.decided",
  title: accepted ? "Paiement accepté" : "Paiement refusé",
  body: accepted ? `Votre plan ${PLAN_LABEL[plan] ?? plan} est actif pour 30 jours.` : `Votre paiement du plan ${PLAN_LABEL[plan] ?? plan} n'a pas été accepté${reason ? ` : ${reason}` : "."}`,
  link: "/dashboard/abonnement",
});

export const bookingConfirmed = (salonName: string, date: string, time: string): Message => ({
  type: "booking.confirmed",
  title: "Rendez-vous confirmé",
  body: `${salonName}, le ${dayLabel(date)} à ${time}.`,
  link: "/compte/rendez-vous",
});

export const bookingReceived = (client: string, date: string, time: string): Message => ({
  type: "booking.new",
  title: "Nouvelle demande à confirmer",
  body: `${client} — ${dayLabel(date)} à ${time}. Confirmez ou refusez depuis le dashboard.`,
  link: "/dashboard",
});

export const bookingRequested = (salonName: string, date: string, time: string): Message => ({
  type: "booking.requested",
  title: "Demande envoyée",
  body: `${salonName}, le ${dayLabel(date)} à ${time} : le salon va confirmer votre rendez-vous.`,
  link: "/compte/rendez-vous",
});

export const bookingCancelled = (salonName: string, date: string, recipient: "client" | "salon", expired = false): Message => ({
  type: "booking.cancelled",
  title: expired ? "Demande expirée" : "Rendez-vous annulé",
  body: expired ? `${salonName} — ${dayLabel(date)} : le salon n'a pas confirmé à temps. Votre acompte éventuel est remboursé.` : `${salonName} — ${dayLabel(date)}`,
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

const longDate = (at: Date) => new Intl.DateTimeFormat("fr-TN", { timeZone: "Africa/Tunis", day: "numeric", month: "long", year: "numeric" }).format(at);

/** FID-07 : préavis un mois avant l'expiration des points */
export const pointsExpiring = (balance: number, expiresAt: Date): Message => ({
  type: "points.expiring",
  title: "Vos points vont expirer",
  body: `Vos ${balance} points Glowy expirent le ${longDate(expiresAt)}. Un rendez-vous ou un avis suffit à les garder.`,
  link: "/compte/fidelite",
});

export const pointsExpired = (points: number): Message => ({
  type: "points.expired",
  title: "Points expirés",
  body: `${points} points Glowy ont expiré après 12 mois sans activité.`,
  link: "/compte/fidelite",
});

const PLAN_NAMES: Record<string, string> = { pro: "Pro", premium: "Premium" };

export const planExpiring = (plan: string, until: Date): Message => ({
  type: "plan.expiring",
  title: `Votre plan ${PLAN_NAMES[plan] ?? plan} se termine bientôt`,
  body: `Il prend fin le ${longDate(until)}. Renouvelez-le pour garder ses fonctions (sinon le salon repasse au plan Gratuit).`,
  link: "/dashboard/abonnement",
});

/** Paie : fiche du mois validée par le gérant */
export const payslipReady = (month: string, payslipId: string): Message => ({
  type: "payslip.ready",
  title: `Fiche de paie de ${month}`,
  body: "Votre fiche de paie est disponible : consultez-la et téléchargez-la depuis votre dossier.",
  link: `/dashboard/paie/${payslipId}`,
});

export const planExpired = (plan: string): Message => ({
  type: "plan.expired",
  title: `Plan ${PLAN_NAMES[plan] ?? plan} terminé`,
  body: "Votre salon est repassé au plan Gratuit. Vos données sont conservées : renouvelez le plan pour retrouver toutes ses fonctions.",
  link: "/dashboard/abonnement",
});

const REMINDER_TITLE = { soon: "Rendez-vous dans moins de 2 heures", today: "Rendez-vous aujourd'hui", tomorrow: "Rendez-vous demain" } as const;

/** RES-07 : rappel la veille (ou le jour même) et moins de 2 h avant le rendez-vous */
export const bookingReminder = (salonName: string, date: string, time: string, when: keyof typeof REMINDER_TITLE): Message => ({
  type: "booking.reminder",
  title: REMINDER_TITLE[when],
  body: `${salonName}, le ${dayLabel(date)} à ${time}. Besoin d'annuler ? Faites-le depuis votre espace.`,
  link: "/compte/rendez-vous",
});
