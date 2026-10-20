import { z } from "zod";

const unit = z.coerce.number().min(0).max(1);
const signed = z.coerce.number().min(-1).max(1);

/** Mesures calculées dans le navigateur (la photo elle-même n'est jamais envoyée) */
export const beautyInput = z.object({
  mode: z.enum(["cheveux", "visage"]),
  metrics: z.object({ brightness: unit, contrast: unit, saturation: unit, highlights: unit, redness: signed, sharpness: unit, topBottomDelta: signed }),
});
