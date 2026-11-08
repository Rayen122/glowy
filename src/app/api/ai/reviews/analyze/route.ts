import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { analyzeReviewInput, analyzeReviewWithAI } from "@/modules/reviews";

/**
 * POST /api/ai/reviews/analyze — { text, rating } → { sentiment, score, aspects, suspicion, source } (IA P4).
 * Lecture par le modèle d'IA (Gemini, source « ai ») ; règles locales en secours (source « lexicon » ou « rating »).
 */
export const POST = route(async (request) => {
  await requireUser();
  return ok(await analyzeReviewWithAI(await readJson(request, analyzeReviewInput)));
});
