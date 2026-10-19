import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";
import { ROLES } from "@/core/domain/actor";
import {
  BOOKING_STATUSES,
  CATEGORIES,
  LOCALES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PHOTO_KINDS,
  PLANS,
  PLAN_PAYMENT_CHANNELS,
  PLAN_PAYMENT_STATUSES,
  POINT_REASONS,
  REPORT_SOURCES,
  REPORT_STATUSES,
  REVIEW_STATUSES,
  SALON_STATUSES,
  USER_STATUSES,
} from "@/core/domain/enums";
import { connectDb } from "./connection";

/**
 * Modèle de données MongoDB (cahier §7), une collection par agrégat.
 * Les données qui vivent toujours avec leur parent sont imbriquées (horaires, photos et prestations
 * d'un salon, lignes et paiement d'une réservation, compte fidélité et favoris d'un utilisateur).
 */

const { ObjectId } = Schema.Types;
const optional = <T>(type: T) => ({ type, default: null });

/** Ré-enregistre le modèle à chaque rechargement à chaud (schéma toujours à jour en développement) */
function defineModel<S extends Schema>(name: string, schema: S) {
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema);
}

// ── Comptes (P1) ────────────────────────────────────────────
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: optional(String),
    firstName: { type: String, required: true },
    lastName: { type: String, default: "" },
    phone: optional(String),
    avatarUrl: optional(String),
    role: { type: String, enum: ROLES, default: "CLIENT" },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE" },
    locale: { type: String, enum: LOCALES, default: "fr" },
    city: optional(String),
    birthDate: optional(Date),
    emailVerified: optional(Date),
    referralCode: { type: String, required: true, unique: true },
    referredBy: { type: ObjectId, ref: "User", default: null },
    /** Blocage temporaire après 5 échecs (AUTH-03) */
    failedLogins: { type: Number, default: 0 },
    lockedUntil: optional(Date),
    /** Compte fidélité (P5) : solde, cumul (niveau), dernière activité (expiration à 12 mois) */
    loyalty: {
      balance: { type: Number, default: 0 },
      lifetime: { type: Number, default: 0 },
      lastActivityAt: { type: Date, default: Date.now },
    },
    /** Salons favoris (CLI-03) */
    favorites: { type: [{ type: ObjectId, ref: "Salon" }], default: [] },
  },
  { timestamps: true }
);
userSchema.index({ role: 1, status: 1 });

// ── Salons (P2 / P3) ────────────────────────────────────────
const serviceSchema = new Schema({
  key: { type: String, required: true },
  name: { type: String, required: true },
  description: optional(String),
  group: { type: String, required: true },
  durationMin: { type: Number, required: true },
  price: { type: Number, required: true },
  oldPrice: optional(Number),
  popular: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  position: { type: Number, default: 0 },
});

const salonSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: optional(String),
    category: { type: String, enum: CATEGORIES, required: true },
    specialties: { type: [String], default: [] },
    city: { type: String, required: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    phone: optional(String),
    coverUrl: optional(String),
    amenities: { type: [String], default: [] },
    /** PENDING tant que le Super Admin n'a pas validé le justificatif (AUTH-02, ADM-02) */
    status: { type: String, enum: SALON_STATUSES, default: "PENDING" },
    verified: { type: Boolean, default: false },
    plan: { type: String, enum: PLANS, default: "gratuit" },
    /** Fin de la période payée du plan Pro / Premium (null pour le plan gratuit) */
    planUntil: optional(Date),
    documentUrl: optional(String),
    depositAmount: { type: Number, default: 20 },
    cancellationHours: { type: Number, default: 24 },
    ratingAvg: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    owner: { type: ObjectId, ref: "User", required: true },
    photos: { type: [{ url: String, kind: { type: String, enum: PHOTO_KINDS, default: "GALLERY" }, position: { type: Number, default: 0 } }], default: [] },
    openingHours: { type: [{ _id: false, weekday: Number, opensAt: String, closesAt: String }], default: [] },
    services: { type: [serviceSchema], default: [] },
  },
  { timestamps: true }
);
salonSchema.index({ status: 1, city: 1 });
salonSchema.index({ owner: 1 });

const employeeSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    /** Compte de connexion de l'employé (AUTH-07), facultatif */
    user: { type: ObjectId, ref: "User", default: null },
    key: { type: String, required: true },
    name: { type: String, required: true },
    title: { type: String, required: true },
    color: { type: Number, default: 1 },
    avatarUrl: optional(String),
    rating: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    /** Horaires propres d'un jour (sinon ceux du salon) ; `off` = jour de repos */
    workingHours: { type: [{ _id: false, weekday: Number, startsAt: String, endsAt: String, off: { type: Boolean, default: false } }], default: [] },
  },
  { timestamps: true }
);
employeeSchema.index({ salon: 1, key: 1 }, { unique: true });
employeeSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $type: "objectId" } } });

const timeOffSchema = new Schema(
  {
    employee: { type: ObjectId, ref: "Employee", required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    label: { type: String, required: true },
  },
  { timestamps: true }
);
timeOffSchema.index({ employee: 1, startsAt: 1 });

/**
 * Anti double réservation (RES-04) au niveau de la base : une ligne par tranche de 5 minutes occupée
 * d'un employé, avec un index UNIQUE (employé, tranche). Deux réservations qui se chevauchent veulent
 * la même tranche → la seconde insertion échoue (E11000), même si deux requêtes arrivent en même temps.
 */
const slotLockSchema = new Schema({
  employee: { type: ObjectId, ref: "Employee", required: true },
  at: { type: Date, required: true },
  booking: { type: ObjectId, ref: "Booking", default: null },
  timeOff: { type: ObjectId, ref: "TimeOff", default: null },
});
slotLockSchema.index({ employee: 1, at: 1 }, { unique: true });
slotLockSchema.index({ booking: 1 });
slotLockSchema.index({ timeOff: 1 });

// ── Réservations (P3) ───────────────────────────────────────
const bookingSchema = new Schema(
  {
    client: { type: ObjectId, ref: "User", required: true },
    salon: { type: ObjectId, ref: "Salon", required: true },
    employee: { type: ObjectId, ref: "Employee", required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "CONFIRMED" },
    totalPrice: { type: Number, required: true },
    deposit: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "ONSITE" },
    note: optional(String),
    offPeak: { type: Boolean, default: false },
    cancelledAt: optional(Date),
    completedAt: optional(Date),
    /** Prestations au prix du jour de la réservation */
    items: { type: [{ _id: false, serviceKey: String, name: String, price: Number, durationMin: Number }], default: [] },
    /** Acompte en ligne — paiement en mode test, aucune donnée de carte stockée */
    payment: {
      type: new Schema(
        {
          amount: Number,
          status: { type: String, enum: PAYMENT_STATUSES, default: "PENDING" },
          provider: { type: String, default: "test" },
          reference: optional(String),
          createdAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);
bookingSchema.index({ employee: 1, startsAt: 1 });
bookingSchema.index({ client: 1, startsAt: -1 });
bookingSchema.index({ salon: 1, startsAt: 1 });

// ── Abonnements des salons (ADM-05) ─────────────────────────
/** Demande de paiement d'un plan : encaissée hors ligne, acceptée ou refusée par le Super Admin */
const planPaymentSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    requestedBy: { type: ObjectId, ref: "User", required: true },
    plan: { type: String, enum: PLANS, required: true },
    amount: { type: Number, required: true },
    channel: { type: String, enum: PLAN_PAYMENT_CHANNELS, default: "VIREMENT" },
    /** Numéro de virement / reçu D17 fourni par le gérant (preuve de paiement) */
    reference: optional(String),
    note: optional(String),
    status: { type: String, enum: PLAN_PAYMENT_STATUSES, default: "PENDING" },
    decidedBy: { type: ObjectId, ref: "User", default: null },
    decidedAt: optional(Date),
    reason: optional(String),
    /** Fin de la période payée, fixée à l'acceptation */
    paidUntil: optional(Date),
  },
  { timestamps: true }
);
planPaymentSchema.index({ status: 1, createdAt: 1 });
planPaymentSchema.index({ salon: 1, createdAt: -1 });

// ── Notifications (CLI-07) ──────────────────────────────────
const notificationSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: optional(String),
    readAt: optional(Date),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ user: 1, createdAt: -1 });

/** Abonnement Web Push d'un appareil (PWA installée ou navigateur) */
const pushSubscriptionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: optional(String),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
pushSubscriptionSchema.index({ user: 1 });

/** E-mails et SMS simulés (démonstration) : conservés pour être consultés par le Super Admin — cahier §1.4 */
const outboxMessageSchema = new Schema(
  {
    channel: { type: String, enum: ["email", "sms"], required: true },
    to: { type: String, required: true },
    subject: { type: String, default: "" },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
outboxMessageSchema.index({ createdAt: -1 });

// ── Fidélité (P5) ───────────────────────────────────────────
/** Barème réglable par le Super Admin (ADM-09) */
const pointRuleSchema = new Schema({
  reason: { type: String, enum: POINT_REASONS, required: true, unique: true },
  points: { type: Number, required: true },
  active: { type: Boolean, default: true },
  monthlyCap: optional(Number),
});

/** Grand livre : toute variation de points laisse une ligne */
const pointTransactionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    points: { type: Number, required: true },
    reason: { type: String, enum: POINT_REASONS, required: true },
    salon: { type: ObjectId, ref: "Salon", default: null },
    booking: { type: ObjectId, ref: "Booking", default: null },
    review: { type: ObjectId, ref: "Review", default: null },
    label: optional(String),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
pointTransactionSchema.index({ user: 1, createdAt: -1 });
pointTransactionSchema.index({ user: 1, reason: 1, createdAt: -1 });

const rewardSchema = new Schema({
  label: { type: String, required: true },
  cost: { type: Number, required: true },
  salon: { type: ObjectId, ref: "Salon", default: null },
  active: { type: Boolean, default: true },
});

const redemptionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    reward: { type: ObjectId, ref: "Reward", required: true },
    points: { type: Number, required: true },
    code: { type: String, required: true, unique: true },
    usedAt: optional(Date),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ── Avis et modération (P4) ─────────────────────────────────
/** Avis vérifié : lié à une réservation terminée (AVI-01), une seule fois (index unique) */
const reviewSchema = new Schema(
  {
    booking: { type: ObjectId, ref: "Booking", required: true, unique: true },
    client: { type: ObjectId, ref: "User", required: true },
    salon: { type: ObjectId, ref: "Salon", required: true },
    employee: { type: ObjectId, ref: "Employee", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    photoUrl: optional(String),
    lang: { type: String, enum: LOCALES, default: "fr" },
    status: { type: String, enum: REVIEW_STATUSES, default: "PUBLISHED" },
    /** Analyse IA des avis (P4) */
    sentiment: optional(String),
    suspicion: optional(Number),
    reply: optional(String),
    repliedAt: optional(Date),
    helpful: { type: Number, default: 0 },
  },
  { timestamps: true }
);
reviewSchema.index({ salon: 1, status: 1, createdAt: -1 });
reviewSchema.index({ client: 1 });

const reviewReportSchema = new Schema(
  {
    review: { type: ObjectId, ref: "Review", required: true },
    reporter: { type: ObjectId, ref: "User", default: null },
    source: { type: String, enum: REPORT_SOURCES, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: REPORT_STATUSES, default: "OPEN" },
    resolvedBy: { type: ObjectId, ref: "User", default: null },
    resolvedAt: optional(Date),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
reviewReportSchema.index({ status: 1, createdAt: 1 });

// ── Espace client et gestion ────────────────────────────────
const photoAnalysisSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    mode: { type: String, required: true },
    result: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
photoAnalysisSchema.index({ user: 1, createdAt: -1 });

/** Journal des actions sensibles (ADM-07) */
const auditLogSchema = new Schema(
  {
    actor: { type: ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: optional(String),
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
auditLogSchema.index({ createdAt: -1 });

export const User = defineModel("User", userSchema);
export const Salon = defineModel("Salon", salonSchema);
export const Employee = defineModel("Employee", employeeSchema);
export const TimeOff = defineModel("TimeOff", timeOffSchema);
export const SlotLock = defineModel("SlotLock", slotLockSchema);
export const Booking = defineModel("Booking", bookingSchema);
export const PlanPayment = defineModel("PlanPayment", planPaymentSchema);
export const Notification = defineModel("Notification", notificationSchema);
export const PushSubscription = defineModel("PushSubscription", pushSubscriptionSchema);
export const OutboxMessage = defineModel("OutboxMessage", outboxMessageSchema);
export const PointRule = defineModel("PointRule", pointRuleSchema);
export const PointTransaction = defineModel("PointTransaction", pointTransactionSchema);
export const Reward = defineModel("Reward", rewardSchema);
export const Redemption = defineModel("Redemption", redemptionSchema);
export const Review = defineModel("Review", reviewSchema);
export const ReviewReport = defineModel("ReviewReport", reviewReportSchema);
export const PhotoAnalysis = defineModel("PhotoAnalysis", photoAnalysisSchema);
export const AuditLog = defineModel("AuditLog", auditLogSchema);

/** Document lu avec .lean() : champs du schéma + _id (+ dates automatiques) */
type Lean<S extends Schema> = InferSchemaType<S> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type UserDoc = Lean<typeof userSchema>;
export type SalonDoc = Lean<typeof salonSchema>;
export type EmployeeDoc = Lean<typeof employeeSchema>;
export type BookingDoc = Omit<Lean<typeof bookingSchema>, "items"> & {
  items: { serviceKey?: string | null; name?: string | null; price?: number | null; durationMin?: number | null }[];
};
export type PlanPaymentDoc = Lean<typeof planPaymentSchema>;
export type ReviewDoc = Lean<typeof reviewSchema>;
export type PointTransactionDoc = Omit<Lean<typeof pointTransactionSchema>, "updatedAt">;

/** Toutes les collections, pour vider la base (seed, tests) */
export const ALL_MODELS = [User, Salon, Employee, TimeOff, SlotLock, Booking, PlanPayment, Notification, PushSubscription, OutboxMessage, PointRule, PointTransaction, Reward, Redemption, Review, ReviewReport, PhotoAnalysis, AuditLog];

/** Vide toutes les collections et recrée les index, dont les index uniques (seed, tests) */
export async function resetAll() {
  await connectDb();
  for (const model of ALL_MODELS as unknown as mongoose.Model<unknown>[]) {
    await model.deleteMany({});
    await model.syncIndexes();
  }
}

// Connexion ouverte au premier import ; les requêtes attendent qu'elle soit prête
void connectDb().catch((error) => console.error("[mongo] connexion impossible", error));
