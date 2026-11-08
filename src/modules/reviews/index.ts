/** Module Avis (P4) — API publique */
import { systemClock } from "@/core/domain/clock";
import type { EventSubscriber } from "@/core/domain/events";
import { eventBus } from "@/infrastructure/event-bus";
import { canManageSalon } from "@/modules/identity";
import { cleanText } from "@/modules/moderation";
import { makeReviews } from "./application/use-cases";
import { analyzeReviewWithAI } from "./infrastructure/ai-analysis";
import { mongoReviewRepository } from "./infrastructure/mongo-review-repository";

export const { createReview, actOnReview, withdrawForNoShow } = makeReviews({ reviews: mongoReviewRepository, access: { canManageSalon }, moderation: { cleanText }, analyzer: { analyze: analyzeReviewWithAI }, events: eventBus, clock: systemClock });

export { createReviewInput, reviewActionInput } from "./application/schemas";
export { canReview, roundRating } from "./domain/policy";
export const refreshSalonRating = mongoReviewRepository.refreshSalonRating;
export { salonReviewsForStaff, STAFF_REVIEW_FILTERS, type StaffReviewFilter, type StaffReviewRow } from "./infrastructure/queries";
export { analyzeMissingReviews, salonReviewInsights, type ReviewInsights } from "./infrastructure/insights";
export { analyzeReview, ASPECTS, summarizeReviews, SUSPICION_ALERT, type Aspect, type ReviewAnalysis } from "./domain/analysis";
export { analyzeReviewInput } from "./application/analyze-schema";
export { analyzeReviewWithAI, refreshReviewSummary } from "./infrastructure/ai-analysis";

/** Rendez-vous pointé « absente » : l'avis publié dès l'heure du rendez-vous est retiré */
export const registerSubscribers = (bus: EventSubscriber) => bus.on("booking.noShow", ({ bookingId }) => withdrawForNoShow(bookingId));
