/**
 * Valeurs métier partagées par plusieurs modules (noyau commun).
 * Les modèles Mongoose s'en servent pour valider les champs (enum).
 */
export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_STATUSES = ["ACTIVE", "BLOCKED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const CATEGORIES = ["coiffure", "barbier", "ongles", "spa", "maquillage", "visage"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PLANS = ["gratuit", "pro", "premium"] as const;
export type PlanId = (typeof PLANS)[number];

/** Prix mensuels des plans d'abonnement, en DT (cahier §9) */
export const PLAN_PRICES: Record<PlanId, number> = { gratuit: 0, pro: 79, premium: 149 };
export const PAID_PLANS = ["pro", "premium"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

/** Paiement d'un abonnement : encaissé hors ligne, validé par le Super Admin avant activation du plan */
export const PLAN_PAYMENT_STATUSES = ["PENDING", "ACCEPTED", "REFUSED"] as const;
export type PlanPaymentStatus = (typeof PLAN_PAYMENT_STATUSES)[number];
export const PLAN_PAYMENT_CHANNELS = ["VIREMENT", "D17", "ESPECES"] as const;
export type PlanPaymentChannel = (typeof PLAN_PAYMENT_CHANNELS)[number];

export const SALON_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"] as const;
export type SalonStatus = (typeof SALON_STATUSES)[number];

export const PHOTO_KINDS = ["GALLERY", "BEFORE", "AFTER"] as const;

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_METHODS = ["ONLINE", "ONSITE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "PAID", "REFUNDED", "FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Moyens d'encaissement en caisse (SAL-09) */
export const CASH_METHODS = ["CASH", "CARD", "D17", "CHEQUE"] as const;
export type CashMethod = (typeof CASH_METHODS)[number];

export const INVOICE_STATUSES = ["PAID", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Promotions du salon (SAL-10) : code à saisir ou remise automatique de dernière minute */
export const PROMOTION_KINDS = ["CODE", "LAST_MINUTE"] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const POINT_REASONS = [
  "BOOKING_COMPLETED",
  "NEW_SALON",
  "SALONS_MILESTONE",
  "REVIEW",
  "REVIEW_PHOTO",
  "REFERRAL",
  "PROFILE_COMPLETED",
  "PHOTO_ANALYSIS",
  "OFF_PEAK",
  "EARLY_BOOKING",
  "PUNCTUALITY",
  "MONTHLY_STREAK",
  "BIRTHDAY",
  "ONLINE_PAYMENT",
  "SHARE",
  "NO_SHOW",
  "REDEMPTION",
  "EXPIRATION",
  "ADJUSTMENT",
] as const;
export type PointReason = (typeof POINT_REASONS)[number];

export const REVIEW_STATUSES = ["PUBLISHED", "HIDDEN"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REPORT_SOURCES = ["USER", "SALON", "AI"] as const;
export type ReportSource = (typeof REPORT_SOURCES)[number];

export const REPORT_STATUSES = ["OPEN", "KEPT", "HIDDEN"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
