import type { Message } from "../domain/messages";

export type StoredNotification = Message & { id: string; readAt: Date | null; createdAt: Date };
export type DeviceSubscription = { endpoint: string; p256dh: string; auth: string };

/** Notifications dans l'application (cloche, CLI-07) */
export interface InAppStore {
  create(userId: string, message: Message): Promise<void>;
  latest(userId: string, take: number): Promise<StoredNotification[]>;
  markAllRead(userId: string, at: Date): Promise<number>;
}

export interface PushSubscriptions {
  forUser(userId: string): Promise<DeviceSubscription[]>;
  save(userId: string, subscription: DeviceSubscription, userAgent: string | null): Promise<void>;
  remove(endpoint: string, userId?: string): Promise<void>;
}

export type PushPayload = { title: string; body: string; url: string; tag: string; lang?: string };

export interface PushSender {
  /** false : clés VAPID absentes, l'envoi push est désactivé */
  readonly enabled: boolean;
  readonly publicKey: string | null;
  /** "gone" : abonnement expiré ou révoqué, à supprimer */
  send(subscription: DeviceSubscription, payload: PushPayload): Promise<"sent" | "gone">;
}

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

/** Données nécessaires aux messages, lues dans les autres modules (lecture seule) */
export interface NotificationFacts {
  salon(salonId: string): Promise<{ name: string; city: string; ownerId: string; ownerEmail: string }>;
  activeAdminIds(): Promise<string[]>;
  booking(bookingId: string): Promise<{
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string | null;
    salonName: string;
    salonOwnerId: string;
    startsAt: Date;
  }>;
  review(reviewId: string): Promise<{ rating: number; text: string; salonOwnerId: string }>;
}
