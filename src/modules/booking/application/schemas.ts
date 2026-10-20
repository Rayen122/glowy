import { z } from "zod";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");

export const availabilityQuery = z.object({
  date: DATE,
  /** clés de prestations séparées par des virgules ; à défaut, créneaux de 30 min */
  services: z.string().optional(),
  employee: z.string().optional(),
});

export const createBookingInput = z.object({
  salonSlug: z.string().min(1),
  serviceKeys: z.array(z.string().min(1)).min(1).max(6),
  /** clé de l'employé ou "any" (premier disponible) */
  employee: z.string().default("any"),
  date: DATE,
  time: TIME,
  paymentMethod: z.enum(["ONLINE", "ONSITE"]).default("ONSITE"),
  note: z.string().trim().max(500).optional(),
  /** Code promo du salon (SAL-10) */
  promoCode: z.string().trim().max(20).optional(),
});

/** Prix d'une réservation avant confirmation : remise de dernière minute ou code promo (SAL-10) */
export const bookingQuoteInput = z.object({
  services: z.string().min(1),
  date: DATE,
  time: TIME,
  code: z.string().trim().max(20).optional(),
  paymentMethod: z.enum(["ONLINE", "ONSITE"]).default("ONSITE"),
});

export const bookingActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("reschedule"), date: DATE, time: TIME }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("noShow") }),
]);

export type AvailabilityQuery = z.infer<typeof availabilityQuery>;
export type CreateBookingInput = z.infer<typeof createBookingInput>;
export type BookingQuoteInput = z.infer<typeof bookingQuoteInput>;

/** RES-09 : liste d'attente d'un jour complet */
export const waitlistInput = z.object({ date: DATE, serviceKeys: z.array(z.string().min(1)).min(1).max(6) });
