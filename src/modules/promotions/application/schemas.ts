import { z } from "zod";
import { PROMOTION_KINDS } from "@/core/domain/enums";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

/** SAL-10 : promotion créée par le gérant */
export const promotionInput = z
  .object({
    kind: z.enum(PROMOTION_KINDS),
    code: z
      .string()
      .trim()
      .transform((c) => c.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{3,20}$/, "3 à 20 lettres, chiffres ou tirets"))
      .nullable()
      .default(null),
    label: z.string().trim().min(3, "3 caractères minimum").max(80),
    percent: z.coerce.number().int().min(1, "Entre 1 et 90 %").max(90, "Entre 1 et 90 %").nullable().default(null),
    amount: z.coerce.number().int().min(1, "Montant positif attendu").max(1000).nullable().default(null),
    minTotal: z.coerce.number().int().min(0).max(10_000).default(0),
    startsOn: DATE.nullable().default(null),
    endsOn: DATE.nullable().default(null),
    withinHours: z.coerce.number().int().min(1).max(48).nullable().default(null),
    maxUses: z.coerce.number().int().min(1).max(100_000).nullable().default(null),
    active: z.boolean().default(true),
  })
  .refine((v) => (v.percent == null) !== (v.amount == null), { message: "Choisissez un pourcentage ou un montant", path: ["percent"] })
  .refine((v) => v.kind !== "CODE" || v.code, { message: "Code requis", path: ["code"] })
  .refine((v) => v.kind !== "LAST_MINUTE" || v.withinHours, { message: "Indiquez le délai en heures", path: ["withinHours"] })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: "La fin doit être après le début", path: ["endsOn"] });
export type PromotionInput = z.infer<typeof promotionInput>;

/** FID-06 : récompense propre au salon, échangée contre des points */
export const salonRewardInput = z.object({
  label: z.string().trim().min(3, "3 caractères minimum").max(80),
  cost: z.coerce.number().int().min(10, "10 points minimum").max(100_000),
  active: z.boolean().default(true),
});
export type SalonRewardInput = z.infer<typeof salonRewardInput>;

/** Validation au comptoir du code de récompense présenté par la cliente */
export const redemptionCodeInput = z.object({ code: z.string().trim().min(4).max(32) });

/** Points salon crédités par visite terminée (0 = programme désactivé) */
export const salonPointsInput = z.object({ perVisit: z.coerce.number().int().min(0).max(500) });

export const salonRewardRedeemInput = z.object({ rewardId: z.string().regex(/^[a-f\d]{24}$/i, "Identifiant invalide") });
