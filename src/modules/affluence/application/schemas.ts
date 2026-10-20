import { z } from "zod";

export const joinQueueInput = z.object({ service: z.string().trim().max(80).optional() });

/** Cliente de passage ajoutée par l'équipe */
export const walkInInput = z.object({ name: z.string().trim().min(2, "2 caractères minimum").max(60), service: z.string().trim().max(80).optional() });

export const queueActionInput = z.object({ action: z.enum(["call", "serve", "noShow", "remove"]) });
export type QueueAction = z.infer<typeof queueActionInput>["action"];
