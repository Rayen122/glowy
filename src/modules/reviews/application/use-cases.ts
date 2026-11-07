import type { Actor } from "@/core/domain/actor";
import type { Clock } from "@/core/domain/clock";
import { conflict, forbidden, notFound } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { analyzeReview, SUSPICION_ALERT } from "../domain/analysis";
import { assertCanReview } from "../domain/policy";
import type { ModerationPort, ReviewRepository, SalonAccessPort } from "./ports";
import type { CreateReviewInput, ReviewActionInput } from "./schemas";

/** Avis vérifiés, réponses, signalements et modération (P4) */
export function makeReviews({ reviews, access, moderation, events, clock }: { reviews: ReviewRepository; access: SalonAccessPort; moderation: ModerationPort; events: EventPublisher; clock: Clock }) {
  async function createReview(actor: Actor, input: CreateReviewInput) {
    const booking = await reviews.bookingForReview(input.bookingId);
    assertCanReview(booking, actor.id, clock.now());
    // IA P4 : sentiment, aspects et suspicion calculés à la publication ; avis suspect → file de modération
    const analysis = analyzeReview(input);
    // Gros mots masqués « *** » (lexique tounsi / arabizi + IA) ; l'analyse garde le texte d'origine
    const text = await moderation.cleanText(input.text);
    const review = await reviews.create({ ...input, text, clientId: actor.id, salonId: booking!.salonId, employeeId: booking!.employeeId, analysis });
    if (analysis.suspicion >= SUSPICION_ALERT) await reviews.report({ reviewId: review.id, reporterId: null, source: "AI", reason: `Analyse automatique : suspicion ${analysis.suspicion} %` });
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
        return reviews.reply(reviewId, await moderation.cleanText(input.reply), clock.now());
      case "helpful":
        return reviews.toggleHelpful(reviewId, actor.id);
      case "report": // AVI-05 ; l'autrice modifie son avis via le support, elle ne le signale pas
        if (review.clientId === actor.id) throw conflict("OWN_REVIEW", "Vous ne pouvez pas signaler votre propre avis.");
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

  /**
   * AVI-01 : un avis n'est « vérifié » que si la visite a eu lieu. Il peut être publié dès l'heure du rendez-vous ;
   * si le salon marque ensuite la cliente absente, l'avis est retiré (note du salon recalculée, points de l'avis repris).
   */
  async function withdrawForNoShow(bookingId: string) {
    const review = await reviews.publishedForBooking(bookingId);
    if (!review) return;
    await reviews.withdraw(review.id, clock.now());
    await reviews.refreshSalonRating(review.salonId);
    await events.publish("review.withdrawn", { reviewId: review.id });
  }

  return { createReview, actOnReview, withdrawForNoShow };
}
