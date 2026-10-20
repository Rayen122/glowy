import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { leaveWaitlist } from "@/modules/booking";

/** DELETE /api/me/waitlist/:id — la cliente quitte une liste d'attente */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/me/waitlist/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("CLIENT");
  return ok(await leaveWaitlist(actor.id, id));
});
