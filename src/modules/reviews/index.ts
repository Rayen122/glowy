/** Module Avis (P4) — API publique */
import { systemClock } from "@/core/domain/clock";
import { eventBus } from "@/infrastructure/event-bus";
import { canManageSalon } from "@/modules/identity";
import { cleanText } from "@/modules/moderation";
import { makeReviews } from "./application/use-cases";
import { mongoReviewRepository } from "./infrastructure/mongo-review-repository";

export const { createReview, actOnReview } = makeReviews({ reviews: mongoReviewRepository, access: { canManageSalon }, moderation: { cleanText }, events: eventBus, clock: systemClock });

export { createReviewInput, reviewActionInput } from "./application/schemas";
export { canReview, roundRating } from "./domain/policy";
export const refreshSalonRating = mongoReviewRepository.refreshSalonRating;
export { salonReviewsForStaff, STAFF_REVIEW_FILTERS, type StaffReviewFilter, type StaffReviewRow } from "./infrastructure/queries";
export { analyzeMissingReviews, salonReviewInsights, type ReviewInsights } from "./infrastructure/insights";
export { analyzeReview, ASPECTS, summarizeReviews, type Aspect, type ReviewAnalysis } from "./domain/analysis";
export { analyzeReviewInput } from "./application/analyze-schema";
