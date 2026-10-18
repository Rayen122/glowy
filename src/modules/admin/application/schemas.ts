import { z } from "zod";

export const salonActionInput = z.object({
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  reason: z.string().trim().max(300).optional(),
});

export const userActionInput = z.object({ action: z.enum(["block", "unblock"]) });

export type SalonActionInput = z.infer<typeof salonActionInput>;
export type UserActionInput = z.infer<typeof userActionInput>;
