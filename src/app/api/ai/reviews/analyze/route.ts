import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { analyzeReview, analyzeReviewInput } from "@/modules/reviews";

/**
 * POST /api/ai/reviews/analyze — { text, rating } → { sentiment, score, aspects, suspicion, source } (IA P4).
 * Analyse locale (lexique FR / EN / AR) ; repli sur la note quand le texte ne donne aucun indice.
 */
export const POST = route(async (request) => {
  await requireUser();
  return ok(analyzeReview(await readJson(request, analyzeReviewInput)));
});
