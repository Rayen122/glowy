import type { PaymentMethod, PointReason } from "@/core/domain/enums";
import { randomCode } from "@/core/domain/text";

/**
 * Règles de fidélité (P5, cahier §3.7) — fonctions pures.
 * Le barème vient de la collection PointRule (réglable par le Super Admin, ADM-09) ; à défaut, DEFAULT_RULES.
 */
export const DEFAULT_RULES: Record<PointReason, { points: number; monthlyCap?: number }> = {
  BOOKING_COMPLETED: { points: 10 },
  NEW_SALON: { points: 30 },
  SALONS_MILESTONE: { points: 50 },
  /** plafond : 1 avis récompensé par salon et par mois */
  REVIEW: { points: 15, monthlyCap: 1 },
  REVIEW_PHOTO: { points: 10, monthlyCap: 1 },
  REFERRAL: { points: 50 },
  PROFILE_COMPLETED: { points: 20 },
  PHOTO_ANALYSIS: { points: 10, monthlyCap: 1 },
  OFF_PEAK: { points: 10 },
  EARLY_BOOKING: { points: 5 },
  PUNCTUALITY: { points: 5 },
  MONTHLY_STREAK: { points: 25 },
  BIRTHDAY: { points: 30 },
  ONLINE_PAYMENT: { points: 5 },
  SHARE: { points: 5, monthlyCap: 3 },
  NO_SHOW: { points: -20 },
  REDEMPTION: { points: 0 },
  EXPIRATION: { points: 0 },
  ADJUSTMENT: { points: 0 },
};

/** Paliers de salons différents visités qui rapportent SALONS_MILESTONE */
export const SALON_MILESTONES = [3, 5, 10];

/** Niveaux (FID-03) : bonus appliqué aux gains selon le cumul de points */
export const TIERS = [
  { id: "bronze", min: 0, bonus: 0 },
  { id: "argent", min: 200, bonus: 0.1 },
  { id: "or", min: 500, bonus: 0.2 },
  { id: "platine", min: 1000, bonus: 0.3 },
] as const;

export const tierFor = (lifetime: number) => [...TIERS].reverse().find((t) => lifetime >= t.min) ?? TIERS[0];
export const nextTierFor = (lifetime: number) => TIERS.find((t) => t.min > lifetime) ?? null;

/** Raisons dont le plafond mensuel se compte par salon (avis) */
export const CAP_PER_SALON: readonly PointReason[] = ["REVIEW", "REVIEW_PHOTO"];

/** Les gains sont majorés selon le niveau ; les pénalités ne le sont pas */
export const withTierBonus = (points: number, lifetime: number) => (points > 0 ? Math.round(points * (1 + tierFor(lifetime).bonus)) : points);

export const startOfMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** Code à présenter au salon après un échange de points (FID-04) */
export const redemptionCode = () => `BH-${randomCode(6)}`;

/** Anti-fraude (FID-07) : au plus 5 gains par jour et par type d'action, sauf réglage du Super Admin */
export const DEFAULT_DAILY_CAP = 5;

/** Préavis : les comptes inactifs depuis 11 mois sont prévenus un mois avant l'expiration (FID-07) */
export const expiryWarningLimit = (now: Date) => {
  const limit = new Date(now);
  limit.setUTCMonth(limit.getUTCMonth() - 11);
  return limit;
};

/** Date d'expiration d'un compte : 12 mois après la dernière activité */
export const expiresOn = (lastActivityAt: Date) => {
  const at = new Date(lastActivityAt);
  at.setUTCFullYear(at.getUTCFullYear() + 1);
  return at;
};

/** Expiration après 12 mois d'inactivité (FID-07) */
export const inactivityLimit = (now: Date) => {
  const limit = new Date(now);
  limit.setUTCFullYear(limit.getUTCFullYear() - 1);
  return limit;
};

/** Ce qu'il faut savoir d'un rendez-vous terminé pour le récompenser */
export type CompletedBookingFacts = {
  bookingId: string;
  clientId: string;
  clientFirstName: string;
  salonId: string;
  salonName: string;
  offPeak: boolean;
  paymentMethod: PaymentMethod;
  /** Délai entre la réservation et le rendez-vous, en heures */
  bookedHoursAhead: number;
  /** Rendez-vous terminés précédents de la cliente dans ce salon */
  earlierCompletedHere: number;
  /** Salons différents où la cliente a terminé un rendez-vous (celui-ci compris) */
  visitedSalons: number;
  /** Rendez-vous terminés de la cliente, tous salons (celui-ci compris) */
  completedCount: number;
  referrer: { id: string; firstName: string } | null;
};

export type PointGrant = { userId: string; reason: PointReason; salonId?: string; bookingId?: string; label?: string; forClient: boolean };

/**
 * Points d'un rendez-vous terminé (FID-02), dans l'ordre d'attribution.
 * Parrainage : +50 pour la filleule et la marraine après le premier rendez-vous terminé de la filleule.
 */
export function rewardsForCompletedBooking(f: CompletedBookingFacts): PointGrant[] {
  const ref = { salonId: f.salonId, bookingId: f.bookingId, label: f.salonName };
  const grants: PointGrant[] = [{ userId: f.clientId, reason: "BOOKING_COMPLETED", ...ref, forClient: true }];
  if (f.earlierCompletedHere === 0) {
    grants.push({ userId: f.clientId, reason: "NEW_SALON", ...ref, forClient: true });
    if (SALON_MILESTONES.includes(f.visitedSalons)) grants.push({ userId: f.clientId, reason: "SALONS_MILESTONE", ...ref, label: String(f.visitedSalons), forClient: true });
  }
  if (f.offPeak) grants.push({ userId: f.clientId, reason: "OFF_PEAK", ...ref, forClient: true });
  if (f.paymentMethod === "ONLINE") grants.push({ userId: f.clientId, reason: "ONLINE_PAYMENT", ...ref, forClient: true });
  if (f.bookedHoursAhead >= 48) grants.push({ userId: f.clientId, reason: "EARLY_BOOKING", ...ref, forClient: true });
  if (f.referrer && f.completedCount === 1) {
    grants.push({ userId: f.clientId, reason: "REFERRAL", bookingId: f.bookingId, label: f.referrer.firstName, forClient: true });
    grants.push({ userId: f.referrer.id, reason: "REFERRAL", bookingId: f.bookingId, label: f.clientFirstName, forClient: false });
  }
  return grants;
}

/** Libellés d'historique (clé du dictionnaire account.loyalty.history) par raison */
export const HISTORY_KEY: Record<PointReason, string> = {
  BOOKING_COMPLETED: "done",
  NEW_SALON: "newSalon",
  SALONS_MILESTONE: "milestone",
  REVIEW: "review",
  REVIEW_PHOTO: "reviewPhoto",
  REFERRAL: "referral",
  PROFILE_COMPLETED: "profile",
  PHOTO_ANALYSIS: "analysis",
  OFF_PEAK: "offPeak",
  EARLY_BOOKING: "early",
  PUNCTUALITY: "punctuality",
  MONTHLY_STREAK: "streak",
  BIRTHDAY: "birthday",
  ONLINE_PAYMENT: "online",
  SHARE: "share",
  NO_SHOW: "noShow",
  REDEMPTION: "redeem",
  EXPIRATION: "expiration",
  ADJUSTMENT: "adjustment",
};
