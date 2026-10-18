import webpush from "web-push";
import type { PushSender } from "../application/ports";

/**
 * Envoi Web Push (protocole standard, clés VAPID). Sans clés dans .env, l'envoi est désactivé
 * et les notifications restent visibles dans l'application.
 */
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
const privateKey = process.env.VAPID_PRIVATE_KEY || null;
const subject = process.env.VAPID_SUBJECT || "mailto:contact@beautyhub.tn";
const enabled = Boolean(publicKey && privateKey) && process.env.NODE_ENV !== "test";

if (enabled) webpush.setVapidDetails(subject, publicKey!, privateKey!);

export const webPushSender: PushSender = {
  enabled,
  publicKey,
  async send(subscription, payload) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24, urgency: "normal" }
      );
      return "sent";
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      throw error;
    }
  },
};
