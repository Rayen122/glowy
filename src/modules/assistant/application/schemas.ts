import { z } from "zod";

export const chatInput = z.object({
  message: z.string().trim().min(1).max(500),
  salonSlug: z.string().max(120).optional(),
  /** Derniers échanges, pour que l'assistante suive la conversation (« w ghodwa ? ») */
  history: z.array(z.object({ role: z.enum(["user", "bot"]), text: z.string().trim().min(1).max(1000) })).max(8).optional(),
});
