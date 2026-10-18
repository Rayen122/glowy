import { ok, readJson, route } from "@/infrastructure/http";
import { createReview, createReviewInput } from "@/modules/reviews";
import { requireUser } from "@/infrastructure/session";

/** POST /api/reviews — avis vérifié sur un rendez-vous terminé (AVI-01, AVI-02) */
export const POST = route(async (request) => {
  const user = await requireUser("CLIENT");
  const input = await readJson(request, createReviewInput);
  return ok(await createReview(user, input), { status: 201 });
});
