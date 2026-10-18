import { objectId, PushSubscription } from "@/infrastructure/db";
import type { PushSubscriptions } from "../application/ports";

export const mongoPushSubscriptions: PushSubscriptions = {
  forUser: async (userId) =>
    (await PushSubscription.find({ user: objectId(userId) }, { endpoint: 1, p256dh: 1, auth: 1 }).lean()).map(({ endpoint, p256dh, auth }) => ({ endpoint, p256dh, auth })),
  save: async (userId, { endpoint, p256dh, auth }, userAgent) => {
    // Un appareil appartient au dernier compte connecté dessus
    await PushSubscription.updateOne({ endpoint }, { $set: { user: objectId(userId), p256dh, auth, userAgent } }, { upsert: true });
  },
  remove: async (endpoint, userId) => {
    await PushSubscription.deleteMany({ endpoint, ...(userId ? { user: objectId(userId) } : {}) });
  },
};
