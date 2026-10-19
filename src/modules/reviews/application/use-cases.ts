import type { Actor } from "@/core/domain/actor";
import type { Clock } from "@/core/domain/clock";
import { forbidden, notFound } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { assertCanReview } from "../domain/policy";
import type { ReviewRepository, SalonAccessPort } from "./ports";
import type { CreateReviewInput, ReviewActionInput } from "./schemas";

/** Avis vérifiés, réponses, signalements et modération (P4) */
export function makeReviews({ reviews, access, events, clock }: { reviews: ReviewRepository; access: SalonAccessPort; events: EventPublisher; clock: Clock }) {
  async function createReview(actor: Actor, input: CreateReviewInput) {
    const booking = await reviews.bookingForReview(input.bookingId);
    assertCanReview(booking, actor.id);
    const review = await reviews.create({ ...input, clientId: actor.id, salonId: booking!.salonId, employeeId: booking!.employeeId });
    await reviews.refreshSalonRating(review.salonId);
    await events.publish("review.published", { reviewId: review.id });
    return review;
  }

  async function actOnReview(actor: Actor, reviewId: string, input: ReviewActionInput) {
    const review = await reviews.findById(reviewId);
    if (!review) throw notFound("Avis introuvable.");
    const isSalonStaff = await access.canManageSalon(actor, review.salonId);

    switch (input.action) {
      case "reply": // AVI-04 : le gérant répond publiquement
        if (!isSalonStaff || actor.role === "EMPLOYEE") throw forbidden();
        return reviews.reply(reviewId, input.reply, clock.now());
      case "helpful":
        return reviews.toggleHelpful(reviewId, actor.id);
      case "report": // AVI-05
        return reviews.report({ reviewId, reporterId: actor.id, source: isSalonStaff ? "SALON" : "USER", reason: input.reason });
      case "hide":
      case "keep": {
        // AVI-06 : décision finale humaine, par le Super Admin
        if (actor.role !== "ADMIN") throw forbidden();
        const updated = await reviews.moderate(reviewId, input.action, actor.id, clock.now());
        await reviews.refreshSalonRating(review.salonId);
        return updated;
      }
    }
  }

  return { createReview, actOnReview };
}
