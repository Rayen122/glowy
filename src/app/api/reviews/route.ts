import { ok, readJson, route } from "@/infrastructure/http";
import { createReview, createReviewInput } from "@/modules/reviews";
import { rateLimit } from "@/infrastructure/rate-limit";
import { requireUser } from "@/infrastructure/session";

/** POST /api/reviews — avis vérifié sur un rendez-vous terminé (AVI-01, AVI-02) */
export const POST = route(async (request) => {
  const user = await requireUser("CLIENT");
  rateLimit("write", user.id);
  const input = await readJson(request, createReviewInput);
  return ok(await createReview(user, input), { status: 201 });
});
