import { z } from "zod";
import { PAID_PLANS, PLAN_PAYMENT_CHANNELS } from "@/core/domain/enums";

/** Demande de paiement d'un plan par le gérant : la référence du virement / du reçu est la preuve de paiement */
export const requestPlanInput = z.object({
  plan: z.enum(PAID_PLANS),
  channel: z.enum(PLAN_PAYMENT_CHANNELS),
  reference: z.string().trim().min(3, "Référence trop courte").max(60),
  note: z.string().trim().max(300).optional(),
});

/** Décision du Super Admin : un refus doit être motivé */
export const decidePaymentInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("refuse"), reason: z.string().trim().min(3, "Indiquez le motif du refus").max(300) }),
]);

export type RequestPlanInput = z.infer<typeof requestPlanInput>;
export type DecidePaymentInput = z.infer<typeof decidePaymentInput>;
