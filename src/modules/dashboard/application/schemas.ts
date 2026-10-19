import { z } from "zod";

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
