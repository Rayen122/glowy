import { after } from "next/server";
import { geminiEnabled } from "@/infrastructure/ai/gemini";
import { objectId, Review, Salon } from "@/infrastructure/db";
import { analyzeReview, summarizeReviews, type Aspect } from "../domain/analysis";
import { refreshReviewSummary, type ReviewSummaryText } from "./ai-analysis";

/** IA P4 : avis pas encore analysés (anciens avis, données importées) — lancé par le planificateur, règles locales (quota du modèle préservé) */
export async function analyzeMissingReviews(limit = 500) {
  const pending = await Review.find({ analyzedAt: null }, { text: 1, rating: 1, suspicion: 1 }).limit(limit).lean();
  for (const r of pending) {
    const a = analyzeReview({ text: r.text, rating: r.rating });
    // Un signal de suspicion déjà posé (modération, import) n'est jamais abaissé
    await Review.updateOne({ _id: r._id }, { $set: { sentiment: a.sentiment, suspicion: Math.max(a.suspicion, r.suspicion ?? 0), aspects: a.aspects, analyzedAt: new Date() } });
  }
  return pending.length;
}

/**
 * Synthèse des avis publiés d'un salon : sentiments, points forts, points à améliorer, et résumé rédigé par le modèle d'IA.
 * Le résumé est recalculé en arrière-plan quand le nombre d'avis a changé (la page ne l'attend pas).
 */
export async function salonReviewInsights(salonId: string) {
  const [reviews, salon] = await Promise.all([
    Review.find({ salon: objectId(salonId), status: "PUBLISHED", analyzedAt: { $ne: null } }, { sentiment: 1, aspects: 1 }).sort({ createdAt: -1 }).limit(300).lean(),
    Salon.findById(objectId(salonId), { reviewSummary: 1 }).lean(),
  ]);
  const summary = summarizeReviews(reviews.map((r) => ({ sentiment: r.sentiment ?? null, aspects: (r.aspects ?? []).map((a) => ({ aspect: a.aspect ?? "", polarity: a.polarity ?? 0 })) })));
  const stored = salon?.reviewSummary;
  if (geminiEnabled() && summary.analysed >= 3 && stored?.count !== reviews.length) {
    // Après l'envoi de la page (sur Vercel, une promesse laissée en cours retenait la réponse jusqu'à 30 s)
    try {
      after(() => refreshReviewSummary(salonId));
    } catch {
      void refreshReviewSummary(salonId); // hors d'une requête (script, test)
    }
  }
  const text: ReviewSummaryText | null = stored?.fr ? { fr: stored.fr, ar: stored.ar ?? stored.fr, en: stored.en ?? stored.fr } : null;
  return { ...summary, strengths: summary.strengths as Aspect[], weaknesses: summary.weaknesses as Aspect[], text };
}

export type ReviewInsights = Awaited<ReturnType<typeof salonReviewInsights>>;
