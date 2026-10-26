/**
 * Module Notifications (CLI-07) — API publique : notification dans l'application + Web Push + e-mail (SMTP ou simulé) / SMS simulés.
 */
import type { EventSubscriber } from "@/core/domain/events";
import { makeNotifier } from "./application/notifier";
import { registerNotificationSubscribers } from "./application/subscribers";
import { consoleSms, emailChannel, emailIsSimulated, latestOutbox } from "./infrastructure/outbox-channels";
import { mongoInAppStore } from "./infrastructure/mongo-in-app-store";
import { mongoNotificationFacts } from "./infrastructure/mongo-notification-facts";
import { mongoPushSubscriptions } from "./infrastructure/mongo-push-subscriptions";
import { sendBookingReminders } from "./infrastructure/reminders";
import { webPushSender } from "./infrastructure/web-push-sender";

const notifier = makeNotifier({ store: mongoInAppStore, subscriptions: mongoPushSubscriptions, push: webPushSender });

export const { notify, subscribe, unsubscribe, inbox, markAllRead, pushPublicKey } = notifier;

export const registerSubscribers = (bus: EventSubscriber) =>
  registerNotificationSubscribers(bus, { notify, facts: mongoNotificationFacts, mailer: emailChannel, sms: consoleSms });

/** E-mail (réel si SMTP est configuré, sinon simulé) ou SMS (simulé), visibles dans la boîte d'envoi du Super Admin */
export const sendEmail = (to: string, subject: string, text: string) => emailChannel.send(to, subject, text);
export const sendSms = (phone: string, text: string) => consoleSms.send(phone, text);
export { emailIsSimulated, latestOutbox };

/** RES-07 : rappels avant les rendez-vous (lancés par le planificateur) */
export const sendReminders = (now = new Date()) => sendBookingReminders({ notify, email: sendEmail, sms: sendSms }, now);

export { bookingReminder, planExpired, planExpiring, pointsEarned, pointsExpired, pointsExpiring, pushTest, type Message } from "./domain/messages";
export { pushSubscriptionInput, pushUnsubscribeInput } from "./application/schemas";
export type { Notify } from "./application/notifier";
