import { z } from "zod";

/** Abonnement envoyé par le navigateur (PushSubscription.toJSON()) */
export const pushSubscriptionInput = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const pushUnsubscribeInput = z.object({ endpoint: z.url().max(1000) });

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInput>;
