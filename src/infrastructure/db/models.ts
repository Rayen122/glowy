import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";
import { ROLES } from "@/core/domain/actor";
import {
  BOOKING_STATUSES,
  CASH_METHODS,
  CATEGORIES,
  INVOICE_STATUSES,
  LOCALES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PHOTO_KINDS,
  PLANS,
  PROMOTION_KINDS,
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
      /** Préavis d'expiration envoyé (FID-07) ; renvoyé seulement après une nouvelle activité */
      expiryWarnedAt: optional(Date),
    },
    /** Salons favoris (CLI-03) */
    favorites: { type: [{ type: ObjectId, ref: "Salon" }], default: [] },
    /** Professionnels favoris (CLI-03) */
    favoriteEmployees: { type: [{ type: ObjectId, ref: "Employee" }], default: [] },
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
    /** Points salon (locaux) crédités à chaque visite terminée (FID-06) ; 0 = pas de programme */
    salonPointsPerVisit: { type: Number, default: 10 },
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
    /** Rappels envoyés (RES-07) : la veille et 2 h avant */
    reminders: { type: new Schema({ day: optional(Date), hour: optional(Date) }, { _id: false }), default: () => ({}) },
    /** Remise de la promotion appliquée (SAL-10) ; totalPrice est le prix après remise */
    discount: { type: Number, default: 0 },
    promo: { type: new Schema({ promotion: { type: ObjectId, ref: "Promotion" }, code: optional(String), label: String }, { _id: false }), default: null },
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

// ── Promotions (SAL-10) ─────────────────────────────────────
/** Code promo ou offre de dernière minute : pourcentage ou montant fixe, période et nombre d'utilisations */
const promotionSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    kind: { type: String, enum: PROMOTION_KINDS, required: true },
    /** En majuscules ; absent pour une offre de dernière minute (appliquée automatiquement) */
    code: optional(String),
    label: { type: String, required: true },
    percent: optional(Number),
    amount: optional(Number),
    minTotal: { type: Number, default: 0 },
    /** Période de validité (dates de Tunis, incluses) */
    startsOn: optional(String),
    endsOn: optional(String),
    /** Dernière minute : créneaux qui commencent dans moins de withinHours heures */
    withinHours: optional(Number),
    maxUses: optional(Number),
    uses: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
promotionSchema.index({ salon: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string" } } });
promotionSchema.index({ salon: 1, kind: 1, active: 1 });

// ── Points salon (FID-06) ───────────────────────────────────
/** Solde de points locaux d'une cliente dans un salon (décrément conditionnel : jamais négatif) */
const salonWalletSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    balance: { type: Number, default: 0 },
    lifetime: { type: Number, default: 0 },
  },
  { timestamps: true }
);
salonWalletSchema.index({ user: 1, salon: 1 }, { unique: true });
salonWalletSchema.index({ salon: 1 });

/** Mouvements de points salon ; une seule ligne VISIT par réservation (index unique) */
const salonPointEntrySchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    points: { type: Number, required: true },
    reason: { type: String, enum: ["VISIT", "REDEMPTION"], required: true },
    booking: { type: ObjectId, ref: "Booking", default: null },
    label: optional(String),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
salonPointEntrySchema.index({ user: 1, salon: 1, createdAt: -1 });
salonPointEntrySchema.index({ booking: 1 }, { unique: true, partialFilterExpression: { reason: "VISIT", booking: { $type: "objectId" } } });

// ── Paramètres de la plateforme (ADM-05, ADM-06) et annonces (ADM-10) ──
/** Document unique (_id « platform ») : catalogue global, langues, commissions ; défauts appliqués en lecture */
const platformSettingSchema = new Schema(
  {
    _id: { type: String, required: true },
    cities: { type: [{ _id: false, name: String, active: { type: Boolean, default: true } }], default: undefined },
    categories: { type: [{ _id: false, id: { type: String, enum: CATEGORIES }, active: { type: Boolean, default: true } }], default: undefined },
    /** Catégories de prestations proposées aux salons (suggestions du catalogue de services) */
    serviceGroups: { type: [String], default: undefined },
    locales: { type: [{ type: String, enum: LOCALES }], default: undefined },
    /** Commission Glowy en % des acomptes payés en ligne, selon le plan du salon */
    commissions: { type: new Schema({ gratuit: Number, pro: Number, premium: Number }, { _id: false }), default: undefined },
  },
  { timestamps: true }
);

const announcementSchema = new Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    audience: { type: String, enum: ["ALL", "CLIENTS", "SALONS"], required: true },
    link: optional(String),
    recipients: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
announcementSchema.index({ createdAt: -1 });

// ── File d'attente virtuelle (RES-08) ───────────────────────
/** Cliente sur place ou en route : WAITING → CALLED → SERVED (ou LEFT / NO_SHOW) */
const queueEntrySchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    client: { type: ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    service: optional(String),
    status: { type: String, enum: ["WAITING", "CALLED", "SERVED", "LEFT", "NO_SHOW"], default: "WAITING" },
    calledAt: optional(Date),
    closedAt: optional(Date),
  },
  { timestamps: true }
);
queueEntrySchema.index({ salon: 1, status: 1, createdAt: 1 });
/** Une seule place active par cliente et par salon */
queueEntrySchema.index({ salon: 1, client: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["WAITING", "CALLED"] }, client: { $type: "objectId" } } });

// ── Stocks (SAL-12) ─────────────────────────────────────────
/** Produit utilisé en prestation ou vendu ; alerte quand la quantité passe sous le seuil */
const productSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    name: { type: String, required: true },
    usage: { type: String, enum: ["salon", "vente"], default: "salon" },
    unit: { type: String, default: "pcs" },
    quantity: { type: Number, default: 0, min: 0 },
    threshold: { type: Number, default: 2 },
    price: optional(Number),
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
productSchema.index({ salon: 1, name: 1 }, { unique: true });

const stockMovementSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    product: { type: ObjectId, ref: "Product", required: true },
    delta: { type: Number, required: true },
    reason: { type: String, enum: ["IN", "OUT", "SALE", "ADJUST"], required: true },
    note: optional(String),
    by: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
stockMovementSchema.index({ salon: 1, createdAt: -1 });

// ── Liste d'attente d'un jour complet (RES-09) ──────────────
const waitlistEntrySchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    client: { type: ObjectId, ref: "User", required: true },
    /** Jour souhaité (date de Tunis) et prestations (clés) */
    date: { type: String, required: true },
    serviceKeys: { type: [String], default: [] },
    status: { type: String, enum: ["ACTIVE", "NOTIFIED", "CANCELLED", "EXPIRED"], default: "ACTIVE" },
    notifiedAt: optional(Date),
  },
  { timestamps: true }
);
waitlistEntrySchema.index({ salon: 1, date: 1, status: 1, createdAt: 1 });
waitlistEntrySchema.index({ salon: 1, client: 1, date: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });

// ── Caisse et factures (SAL-09) ─────────────────────────────
/** Compteurs de numérotation (factures : une suite par salon et par année, sans trou) */
const counterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });

/** Facture : copie figée des lignes et de la cliente au moment de l'encaissement ; annulée, jamais supprimée */
const invoiceSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    number: { type: String, required: true },
    booking: { type: ObjectId, ref: "Booking", default: null },
    client: { type: ObjectId, ref: "User", default: null },
    clientName: { type: String, required: true },
    clientEmail: optional(String),
    clientPhone: optional(String),
    lines: { type: [{ _id: false, label: String, quantity: Number, unitPrice: Number }], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    /** Acompte déjà payé en ligne, déduit du reste à payer */
    deposit: { type: Number, default: 0 },
    total: { type: Number, required: true },
    /** Encaissé au comptoir */
    due: { type: Number, required: true },
    method: { type: String, enum: CASH_METHODS, required: true },
    status: { type: String, enum: INVOICE_STATUSES, default: "PAID" },
    issuedBy: { type: ObjectId, ref: "User", required: true },
    voidedAt: optional(Date),
    voidReason: optional(String),
  },
  { timestamps: true }
);
invoiceSchema.index({ salon: 1, number: 1 }, { unique: true });
invoiceSchema.index({ salon: 1, createdAt: -1 });
invoiceSchema.index({ client: 1, createdAt: -1 });
/** Une seule facture payée par réservation (une facture annulée libère la réservation) */
invoiceSchema.index({ booking: 1 }, { unique: true, partialFilterExpression: { booking: { $type: "objectId" }, status: "PAID" } });

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

/** Lien à usage unique envoyé par e-mail : réinitialisation du mot de passe (AUTH-05), vérification de l'adresse (AUTH-06). Seule l'empreinte SHA-256 est stockée. */
const accountTokenSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    purpose: { type: String, enum: ["reset", "verify"], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: optional(Date),
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
// Les jetons expirés disparaissent seuls (index TTL)
accountTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

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
  /** Anti-fraude (FID-07) : plafond de lignes par jour et par type d'action ; null = défaut */
  dailyCap: optional(Number),
});

/** Campagne « double points » (ADM-09) : multiplie les gains pendant une période, pour certaines actions ou toutes */
const pointCampaignSchema = new Schema(
  {
    label: { type: String, required: true },
    multiplier: { type: Number, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    /** Vide : toutes les actions qui rapportent des points */
    reasons: { type: [{ type: String, enum: POINT_REASONS }], default: [] },
    active: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
pointCampaignSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

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
    /** Analyse IA des avis (P4) : sentiment, aspects évoqués, score de suspicion de faux avis */
    sentiment: optional(String),
    suspicion: optional(Number),
    aspects: { type: [{ _id: false, aspect: String, polarity: Number }], default: [] },
    analyzedAt: optional(Date),
    reply: optional(String),
    repliedAt: optional(Date),
    helpful: { type: Number, default: 0 },
    /** Utilisateurs ayant trouvé l'avis utile (un vote par personne) */
    helpfulBy: { type: [{ type: ObjectId, ref: "User" }], default: [] },
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

/** SAL-08 : note du salon sur une cliente (allergie, préférence, remarque) — visible du seul personnel du salon */
const clientNoteSchema = new Schema(
  {
    salon: { type: ObjectId, ref: "Salon", required: true },
    client: { type: ObjectId, ref: "User", required: true },
    author: { type: ObjectId, ref: "User", default: null },
    kind: { type: String, enum: ["allergy", "preference", "note"], default: "note" },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
clientNoteSchema.index({ salon: 1, client: 1, createdAt: -1 });

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
export const AccountToken = defineModel("AccountToken", accountTokenSchema);
export const PointRule = defineModel("PointRule", pointRuleSchema);
export const PointTransaction = defineModel("PointTransaction", pointTransactionSchema);
export const PointCampaign = defineModel("PointCampaign", pointCampaignSchema);
export const Reward = defineModel("Reward", rewardSchema);
export const Redemption = defineModel("Redemption", redemptionSchema);
export const Review = defineModel("Review", reviewSchema);
export const ReviewReport = defineModel("ReviewReport", reviewReportSchema);
export const PhotoAnalysis = defineModel("PhotoAnalysis", photoAnalysisSchema);
export const AuditLog = defineModel("AuditLog", auditLogSchema);
export const ClientNote = defineModel("ClientNote", clientNoteSchema);
export const Promotion = defineModel("Promotion", promotionSchema);
export const SalonWallet = defineModel("SalonWallet", salonWalletSchema);
export const SalonPointEntry = defineModel("SalonPointEntry", salonPointEntrySchema);
export const PlatformSetting = defineModel("PlatformSetting", platformSettingSchema);
export const Announcement = defineModel("Announcement", announcementSchema);
export const QueueEntry = defineModel("QueueEntry", queueEntrySchema);
export const Product = defineModel("Product", productSchema);
export const StockMovement = defineModel("StockMovement", stockMovementSchema);
export const WaitlistEntry = defineModel("WaitlistEntry", waitlistEntrySchema);
export const Counter = defineModel("Counter", counterSchema);
export const Invoice = defineModel("Invoice", invoiceSchema);

/** Document lu avec .lean() : champs du schéma + _id (+ dates automatiques) */
type Lean<S extends Schema> = InferSchemaType<S> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type UserDoc = Lean<typeof userSchema>;
export type SalonDoc = Lean<typeof salonSchema>;
export type EmployeeDoc = Lean<typeof employeeSchema>;
export type BookingDoc = Omit<Lean<typeof bookingSchema>, "items"> & {
  items: { serviceKey?: string | null; name?: string | null; price?: number | null; durationMin?: number | null }[];
};
export type PlanPaymentDoc = Lean<typeof planPaymentSchema>;
export type ReviewDoc = Omit<Lean<typeof reviewSchema>, "aspects"> & { aspects: { aspect?: string | null; polarity?: number | null }[] };
export type PromotionDoc = Lean<typeof promotionSchema>;
export type PointTransactionDoc = Omit<Lean<typeof pointTransactionSchema>, "updatedAt">;

/** Toutes les collections, pour vider la base (seed, tests) */
export const ALL_MODELS = [User, Salon, Employee, TimeOff, SlotLock, Booking, PlanPayment, Notification, PushSubscription, OutboxMessage, AccountToken, PointRule, PointTransaction, PointCampaign, Reward, Redemption, Review, ReviewReport, PhotoAnalysis, AuditLog, ClientNote, Promotion, SalonWallet, SalonPointEntry, PlatformSetting, Announcement, QueueEntry, Product, StockMovement, WaitlistEntry, Counter, Invoice];

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
