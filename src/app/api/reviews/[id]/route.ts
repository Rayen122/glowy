import { ok, readJson, route } from "@/infrastructure/http";
import { actOnReview, reviewActionInput } from "@/modules/reviews";
import { requireUser } from "@/infrastructure/session";

/** PATCH /api/reviews/:id — reply (gérant) · report (tous) · hide / keep (Super Admin) */
export const PATCH = route(async (request, ctx: RouteContext<"/api/reviews/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser();
  const input = await readJson(request, reviewActionInput);
  return ok(await actOnReview(actor, id, input));
});
