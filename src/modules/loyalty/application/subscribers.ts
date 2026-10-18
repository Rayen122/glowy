import type { EventSubscriber } from "@/core/domain/events";
import { rewardsForCompletedBooking } from "../domain/rules";
import type { LoyaltyFacts } from "./ports";
import type { Loyalty } from "./use-cases";

type PointsMessage = (userId: string, points: number, body: string) => Promise<void>;

/** Réactions « fidélité » aux événements : points après un rendez-vous terminé (jamais avant), pénalités, avis */
export function registerLoyaltySubscribers(bus: EventSubscriber, { loyalty, facts, notifyPoints }: { loyalty: Loyalty; facts: LoyaltyFacts; notifyPoints: PointsMessage }) {
  bus.on("booking.completed", async ({ bookingId }) => {
    const booking = await facts.completedBooking(bookingId);
    if (!booking || (await loyalty.alreadyAwarded(booking.clientId, "BOOKING_COMPLETED", { bookingId }))) return;
    let total = 0;
    for (const grant of rewardsForCompletedBooking(booking)) {
      const points = await loyalty.award(grant.userId, grant.reason, { salonId: grant.salonId, bookingId: grant.bookingId, label: grant.label });
      if (grant.forClient) total += points;
    }
    if (total > 0) await notifyPoints(booking.clientId, total, `Merci pour votre visite chez ${booking.salonName}. Donnez votre avis pour gagner plus de points.`);
  });

  bus.on("booking.cancelled", async ({ bookingId, late, by }) => {
    if (!late || by !== "client") return;
    const booking = await facts.booking(bookingId);
    await loyalty.award(booking.clientId, "NO_SHOW", { salonId: booking.salonId, bookingId, label: booking.salonName });
  });

  bus.on("booking.noShow", async ({ bookingId }) => {
    const booking = await facts.booking(bookingId);
    if (await loyalty.alreadyAwarded(booking.clientId, "NO_SHOW", { bookingId })) return;
    await loyalty.award(booking.clientId, "NO_SHOW", { salonId: booking.salonId, bookingId, label: booking.salonName });
  });

  bus.on("review.published", async ({ reviewId }) => {
    const review = await facts.review(reviewId);
    const ref = { salonId: review.salonId, reviewId, label: review.salonName };
    let total = await loyalty.award(review.clientId, "REVIEW", ref);
    if (review.hasPhoto && total > 0) total += await loyalty.award(review.clientId, "REVIEW_PHOTO", ref);
    if (total > 0) await notifyPoints(review.clientId, total, "Merci pour votre avis vérifié !");
  });
}
