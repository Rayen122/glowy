import { z } from "zod";

export const createReviewInput = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(10, "10 caractères minimum").max(2000),
  photoUrl: z.url().optional(),
  lang: z.enum(["fr", "ar", "en"]).default("fr"),
});

export const reviewActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), reply: z.string().trim().min(2).max(1000) }),
  z.object({ action: z.literal("report"), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal("hide") }),
  z.object({ action: z.literal("keep") }),
]);

export type CreateReviewInput = z.infer<typeof createReviewInput>;
export type ReviewActionInput = z.infer<typeof reviewActionInput>;
