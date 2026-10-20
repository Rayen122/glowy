import { objectId, Review } from "@/infrastructure/db";
import { analyzeReview, summarizeReviews, type Aspect } from "../domain/analysis";

/** IA P4 : avis pas encore analysés (anciens avis, données importées) — lancé par le planificateur */
export async function analyzeMissingReviews(limit = 500) {
  const pending = await Review.find({ analyzedAt: null }, { text: 1, rating: 1, suspicion: 1 }).limit(limit).lean();
  for (const r of pending) {
    const a = analyzeReview({ text: r.text, rating: r.rating });
    // Un signal de suspicion déjà posé (modération, import) n'est jamais abaissé
    await Review.updateOne({ _id: r._id }, { $set: { sentiment: a.sentiment, suspicion: Math.max(a.suspicion, r.suspicion ?? 0), aspects: a.aspects, analyzedAt: new Date() } });
  }
  return pending.length;
}

/** Synthèse des avis publiés d'un salon : sentiments, points forts, points à améliorer */
export async function salonReviewInsights(salonId: string) {
  const reviews = await Review.find({ salon: objectId(salonId), status: "PUBLISHED", analyzedAt: { $ne: null } }, { sentiment: 1, aspects: 1 }).sort({ createdAt: -1 }).limit(300).lean();
  const summary = summarizeReviews(reviews.map((r) => ({ sentiment: r.sentiment ?? null, aspects: (r.aspects ?? []).map((a) => ({ aspect: a.aspect ?? "", polarity: a.polarity ?? 0 })) })));
  return { ...summary, strengths: summary.strengths as Aspect[], weaknesses: summary.weaknesses as Aspect[] };
}

export type ReviewInsights = Awaited<ReturnType<typeof salonReviewInsights>>;
