import { z } from "zod";
import { CASH_METHODS } from "@/core/domain/enums";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");

/** Blocage d'un créneau dans l'agenda (SAL-04) : pause, congé, indisponibilité */
export const blockSlotInput = z
  .object({
    employeeId: z.string().min(1),
    date: DATE,
    from: TIME,
    to: TIME,
    label: z.string().trim().min(1, "Indiquez un libellé").max(60),
  })
  .refine((v) => v.to > v.from, { message: "L'heure de fin doit être après l'heure de début", path: ["to"] });

export type BlockSlotInput = z.infer<typeof blockSlotInput>;

const MONEY = z.coerce.number().int("Montant entier en DT").min(0).max(10_000);

/** SAL-03 : prestation proposée à la réservation (forfait = prestation de la catégorie « Forfaits ») */
export const serviceInput = z
  .object({
    name: z.string().trim().min(2, "2 caractères minimum").max(80),
    group: z.string().trim().min(2, "Indiquez une catégorie").max(40),
    description: z.string().trim().max(300).optional().nullable(),
    durationMin: z.coerce.number().int().min(5, "5 minutes minimum").max(600, "10 heures maximum").multipleOf(5, "Durée par pas de 5 minutes"),
    price: MONEY,
    oldPrice: MONEY.optional().nullable(),
    popular: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine((v) => v.oldPrice == null || v.oldPrice > v.price, { message: "L'ancien prix doit être supérieur au prix", path: ["oldPrice"] });

export type ServiceInput = z.infer<typeof serviceInput>;

/** Image : envoyée sur Glowy (/api/media/…) ou adresse https externe */
const IMAGE_URL = z.string().trim().regex(/^(https:\/\/\S+|\/api\/media\/[a-f\d]{24})$/i, "Image invalide");

/** SAL-02 et SAL-07 : profil public du salon et règles de réservation (mise à jour partielle, une section à la fois) */
export const salonSettingsInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(1000).nullable(),
    phone: z.string().trim().regex(/^[+\d\s]{8,20}$/, "Numéro invalide").nullable(),
    address: z.string().trim().min(4).max(160),
    city: z.string().trim().min(2).max(60),
    coverUrl: IMAGE_URL.nullable(),
    photos: z.array(z.object({ url: IMAGE_URL, kind: z.enum(["GALLERY", "BEFORE", "AFTER"]) })).max(30, "30 photos maximum"),
    amenities: z.array(z.string().trim().min(1).max(40)).max(12),
    openingHours: z
      .array(z.object({ weekday: z.number().int().min(0).max(6), opensAt: TIME, closesAt: TIME }))
      .max(7)
      .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, "Un même jour apparaît deux fois")
      .refine((days) => days.every((d) => d.closesAt > d.opensAt), "L'heure de fermeture doit être après l'ouverture"),
    cancellationHours: z.coerce.number().int().min(0).max(72),
    depositAmount: z.coerce.number().int().min(0, "0 % = pas d'acompte").max(50, "50 % maximum"),
  })
  .partial();

export type SalonSettingsInput = z.infer<typeof salonSettingsInput>;

/** SAL-05 : professionnel du salon et ses horaires de travail (dans les horaires du salon) */
export const employeeInput = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(60),
  title: z.string().trim().min(2, "Indiquez le métier").max(60),
  color: z.coerce.number().int().min(1).max(5).default(1),
  /** SAL-13 : commission en % du chiffre d'affaires réalisé */
  commissionRate: z.coerce.number().min(0, "Entre 0 et 80 %").max(80, "Entre 0 et 80 %").default(0),
  avatarUrl: IMAGE_URL.nullable().default(null),
  active: z.boolean().default(true),
  workingHours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), startsAt: TIME, endsAt: TIME, off: z.boolean().default(false) }))
    .max(7)
    .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, "Un même jour apparaît deux fois")
    .refine((days) => days.every((d) => d.off || d.endsAt > d.startsAt), "L'heure de fin doit être après le début")
    .default([]),
});

/** Congé d'un professionnel, sur un ou plusieurs jours entiers */
export const leaveInput = z
  .object({ from: DATE, to: DATE, label: z.string().trim().min(1, "Indiquez un libellé").max(60) })
  .refine((v) => v.to >= v.from, { message: "La date de fin doit être après la date de début", path: ["to"] });

/** AUTH-07 : compte de connexion d'un employé */
export const employeeAccountInput = z.object({ email: z.email("Adresse e-mail invalide").trim().toLowerCase() });

export type EmployeeInput = z.infer<typeof employeeInput>;
export type LeaveInput = z.infer<typeof leaveInput>;

/** SAL-08 : note du salon sur une cliente */
export const clientNoteInput = z.object({
  kind: z.enum(["allergy", "preference", "note"]).default("note"),
  text: z.string().trim().min(2, "2 caractères minimum").max(500),
});
export type ClientNoteInput = z.infer<typeof clientNoteInput>;

const OBJECT_ID = z.string().regex(/^[a-f\d]{24}$/i, "Identifiant invalide");
const AMOUNT = z.coerce.number().min(0, "Montant positif attendu").max(100_000);

/** SAL-09 : encaissement d'un rendez-vous ou vente libre au comptoir */
export const checkoutInput = z
  .object({
    bookingId: OBJECT_ID.nullable().default(null),
    clientName: z.string().trim().max(80).optional(),
    lines: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Libellé requis").max(80),
          quantity: z.coerce.number().int().min(1).max(99),
          unitPrice: AMOUNT,
        })
      )
      .min(1, "Ajoutez au moins une ligne")
      .max(30),
    discount: AMOUNT.default(0),
    method: z.enum(CASH_METHODS),
  })
  .refine((v) => v.bookingId || (v.clientName?.length ?? 0) >= 2, { message: "Nom de la cliente requis", path: ["clientName"] });
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const voidInvoiceInput = z.object({ reason: z.string().trim().min(3, "3 caractères minimum").max(200) });

/** SAL-12 : produit du stock */
export const productInput = z.object({
  name: z.string().trim().min(2, "2 caractères minimum").max(80),
  usage: z.enum(["salon", "vente"]).default("salon"),
  unit: z.string().trim().min(1).max(10).default("pcs"),
  threshold: z.coerce.number().int().min(0).max(10_000).default(2),
  price: z.coerce.number().min(0).max(10_000).nullable().default(null),
  active: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productInput>;

/** Entrée (livraison), sortie (utilisation), vente ou correction d'inventaire */
export const stockMoveInput = z.object({
  delta: z.coerce.number().int().refine((n) => n !== 0, "Quantité non nulle").refine((n) => Math.abs(n) <= 10_000, "Quantité trop grande"),
  reason: z.enum(["IN", "OUT", "SALE", "ADJUST"]),
  note: z.string().trim().max(120).optional(),
});
export type StockMoveInput = z.infer<typeof stockMoveInput>;
