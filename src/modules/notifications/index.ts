/**
 * Module Notifications (CLI-07) — API publique : notification dans l'application + Web Push + e-mail / SMS simulés.
 */
import type { EventSubscriber } from "@/core/domain/events";
import { makeNotifier } from "./application/notifier";
import { registerNotificationSubscribers } from "./application/subscribers";
import { consoleMailer, consoleSms } from "./infrastructure/console-channels";
import { mongoInAppStore } from "./infrastructure/mongo-in-app-store";
import { mongoNotificationFacts } from "./infrastructure/mongo-notification-facts";
import { mongoPushSubscriptions } from "./infrastructure/mongo-push-subscriptions";
import { webPushSender } from "./infrastructure/web-push-sender";

const notifier = makeNotifier({ store: mongoInAppStore, subscriptions: mongoPushSubscriptions, push: webPushSender });

export const { notify, subscribe, unsubscribe, inbox, markAllRead, pushPublicKey } = notifier;

export const registerSubscribers = (bus: EventSubscriber) =>
  registerNotificationSubscribers(bus, { notify, facts: mongoNotificationFacts, mailer: consoleMailer, sms: consoleSms });

export { pointsEarned, pushTest, type Message } from "./domain/messages";
export { pushSubscriptionInput, pushUnsubscribeInput } from "./application/schemas";
export type { Notify } from "./application/notifier";
