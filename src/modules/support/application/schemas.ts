import { z } from "zod";

export const SUPPORT_CATEGORIES = ["booking", "payment", "account", "review", "other"] as const;

export const ticketInput = z.object({
  subject: z.string().trim().min(5, "5 caractères minimum").max(120),
  category: z.enum(SUPPORT_CATEGORIES).default("other"),
  text: z.string().trim().min(10, "10 caractères minimum").max(2000),
});
export type TicketInput = z.infer<typeof ticketInput>;

export const ticketMessageInput = z.object({ text: z.string().trim().min(2, "2 caractères minimum").max(2000) });
export const ticketStatusInput = z.object({ status: z.enum(["OPEN", "CLOSED"]) });
