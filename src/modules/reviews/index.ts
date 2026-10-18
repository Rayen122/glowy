/** Module Avis (P4) — API publique */
import { systemClock } from "@/core/domain/clock";
import { eventBus } from "@/infrastructure/event-bus";
import { canManageSalon } from "@/modules/identity";
import { makeReviews } from "./application/use-cases";
import { mongoReviewRepository } from "./infrastructure/mongo-review-repository";

export const { createReview, actOnReview } = makeReviews({ reviews: mongoReviewRepository, access: { canManageSalon }, events: eventBus, clock: systemClock });

export { createReviewInput, reviewActionInput } from "./application/schemas";
export { roundRating } from "./domain/policy";
export const refreshSalonRating = mongoReviewRepository.refreshSalonRating;
