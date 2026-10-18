import { idOf, Notification, objectId } from "@/infrastructure/db";
import type { InAppStore } from "../application/ports";

export const mongoInAppStore: InAppStore = {
  create: async (userId, message) => {
    await Notification.create({ user: objectId(userId)!, ...message });
  },
  latest: async (userId, take) =>
    (await Notification.find({ user: objectId(userId) }).sort({ createdAt: -1 }).limit(take).lean()).map((n) => ({
      id: idOf(n),
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link ?? undefined,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    })),
  markAllRead: async (userId, at) => (await Notification.updateMany({ user: objectId(userId), readAt: null }, { $set: { readAt: at } })).modifiedCount,
};
