import { z } from "zod";
import { DATE } from "@/core/schemas";
import { POINT_REASONS } from "@/core/domain/enums";

const CAP = z.coerce.number().int().min(1).max(1000).nullable().default(null);

/** ADM-09 : réglage d'une ligne du barème */
export const pointRuleInput = z.object({
  points: z.coerce.number().int().min(-200, "Entre −200 et 1 000").max(1000, "Entre −200 et 1 000"),
  active: z.boolean(),
  monthlyCap: CAP,
  dailyCap: CAP,
});
export type PointRuleInput = z.infer<typeof pointRuleInput>;

/** ADM-09 : campagne « double points » sur une période (dates de Tunis, incluses) */
export const pointCampaignInput = z
  .object({
    label: z.string().trim().min(3, "3 caractères minimum").max(80),
    multiplier: z.coerce.number().min(1.5, "Entre ×1,5 et ×5").max(5, "Entre ×1,5 et ×5"),
    startsOn: DATE,
    endsOn: DATE,
    reasons: z.array(z.enum(POINT_REASONS)).max(POINT_REASONS.length).default([]),
    active: z.boolean().default(true),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "La fin doit être après le début", path: ["endsOn"] });
export type PointCampaignInput = z.infer<typeof pointCampaignInput>;

export const campaignToggleInput = z.object({ active: z.boolean() });
