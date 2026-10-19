import { z } from "zod";

export const createReviewInput = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, "10 caractères minimum").max(2000),
  /** AVI-02 : photo envoyée sur Glowy (/api/media/…) ou adresse https */
  photoUrl: z.string().trim().regex(/^(https:\/\/\S+|\/api\/media\/[a-f\d]{24})$/i, "Photo invalide").optional(),
  lang: z.enum(["fr", "ar", "en"]).default("fr"),
});

export const reviewActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), reply: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("report"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("hide") }),
  z.object({ action: z.literal("keep") }),
  z.object({ action: z.literal("helpful") }),
]);

export type CreateReviewInput = z.infer<typeof createReviewInput>;
export type ReviewActionInput = z.infer<typeof reviewActionInput>;
