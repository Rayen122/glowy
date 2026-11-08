import { utcToTunis } from "@/core/domain/time";
import type { EventSubscriber } from "@/core/domain/events";
import * as messages from "../domain/messages";
import type { Notify } from "./notifier";
import type { Mailer, NotificationFacts, SmsSender } from "./ports";

type Deps = { notify: Notify; facts: NotificationFacts; mailer: Mailer; sms: SmsSender };

/** Réactions « notifications » aux événements des autres modules (comptes, salons, réservations, avis) */
export function registerNotificationSubscribers(bus: EventSubscriber, { notify, facts, mailer, sms }: Deps) {
  bus.on("user.registered", ({ userId }) => notify(userId, messages.welcome()));

  bus.on("salon.registered", async ({ salonId }) => {
    const [salon, admins] = await Promise.all([facts.salon(salonId), facts.activeAdminIds()]);
    for (const adminId of admins) await notify(adminId, messages.salonPending(salon));
  });

  bus.on("salon.statusChanged", async ({ salonId, status }) => {
    const salon = await facts.salon(salonId);
    const message = messages.salonStatusChanged(salon.name, status);
    if (!message) return;
    await notify(salon.ownerId, message);
    await mailer.send(salon.ownerEmail, `Glowy — ${salon.name}`, message.body);
  });

  bus.on("plan.paymentRequested", async ({ paymentId }) => {
    const [payment, admins] = await Promise.all([facts.planPayment(paymentId), facts.activeAdminIds()]);
    for (const adminId of admins) await notify(adminId, messages.planPaymentRequested(payment.salonName, payment.plan, payment.amount));
  });

  bus.on("plan.paymentDecided", async ({ paymentId }) => {
    const payment = await facts.planPayment(paymentId);
    const message = messages.planPaymentDecided(payment.plan, payment.accepted, payment.reason);
    await notify(payment.ownerId, message);
    await mailer.send(payment.ownerEmail, `Glowy — ${message.title}`, message.body);
  });

  bus.on("booking.created", async ({ bookingId }) => {
    const booking = await facts.booking(bookingId);
    const { date, time } = utcToTunis(booking.startsAt);
    const requested = messages.bookingRequested(booking.salonName, date, time);
    await notify(booking.clientId, requested);
    await notify(booking.salonOwnerId, messages.bookingReceived(booking.clientName, date, time));
    await mailer.send(booking.clientEmail, "Votre demande de rendez-vous Glowy", requested.body);
  });

  // Le salon accepte la demande : la cliente est prévenue (notification, e-mail, SMS)
  bus.on("booking.confirmed", async ({ bookingId }) => {
    const booking = await facts.booking(bookingId);
    const { date, time } = utcToTunis(booking.startsAt);
    const confirmed = messages.bookingConfirmed(booking.salonName, date, time);
    await notify(booking.clientId, confirmed);
    await mailer.send(booking.clientEmail, "Votre rendez-vous Glowy est confirmé", confirmed.body);
    if (booking.clientPhone) await sms.send(booking.clientPhone, `Glowy : RDV confirmé, ${confirmed.body}`);
  });

  bus.on("booking.cancelled", async ({ bookingId, by, expired }) => {
    const booking = await facts.booking(bookingId);
    const recipient = by === "client" ? "salon" : "client";
    await notify(recipient === "salon" ? booking.salonOwnerId : booking.clientId, messages.bookingCancelled(booking.salonName, utcToTunis(booking.startsAt).date, recipient, expired));
  });

  bus.on("review.published", async ({ reviewId }) => {
    const review = await facts.review(reviewId);
    await notify(review.salonOwnerId, messages.reviewReceived(review.rating, review.text));
  });
}
