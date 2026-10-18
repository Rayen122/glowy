import type { Message } from "../domain/messages";
import type { InAppStore, PushSender, PushSubscriptions } from "./ports";
import type { PushSubscriptionInput } from "./schemas";

export type NotifierDeps = { store: InAppStore; subscriptions: PushSubscriptions; push: PushSender };

/**
 * Envoi d'une notification : enregistrée dans l'application, puis poussée sur chaque appareil abonné.
 * Un échec push n'empêche jamais l'action d'origine ; les abonnements expirés sont supprimés.
 */
export function makeNotifier({ store, subscriptions, push }: NotifierDeps) {
  async function notify(userId: string, message: Message) {
    await store.create(userId, message);
    if (!push.enabled) return;
    const devices = await subscriptions.forUser(userId);
    await Promise.all(
      devices.map(async (device) => {
        try {
          const result = await push.send(device, { title: message.title, body: message.body, url: message.link ?? "/", tag: message.type });
          if (result === "gone") await subscriptions.remove(device.endpoint);
        } catch (error) {
          console.error("[push] envoi impossible", error);
        }
      })
    );
  }

  async function subscribe(userId: string, input: PushSubscriptionInput, userAgent: string | null) {
    await subscriptions.save(userId, { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth }, userAgent?.slice(0, 300) ?? null);
  }

  const unsubscribe = (userId: string, endpoint: string) => subscriptions.remove(endpoint, userId);

  async function inbox(userId: string) {
    const notifications = await store.latest(userId, 30);
    return { unread: notifications.filter((n) => !n.readAt).length, notifications };
  }

  return { notify, subscribe, unsubscribe, inbox, markAllRead: store.markAllRead, pushPublicKey: push.publicKey };
}

export type Notify = ReturnType<typeof makeNotifier>["notify"];
