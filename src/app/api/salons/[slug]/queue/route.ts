import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { joinQueue, joinQueueInput, leaveQueue } from "@/modules/affluence";

/** POST /api/salons/:slug/queue — { service? } : la cliente prend place dans la file d'attente (RES-08) */
export const POST = route(async (request, ctx: RouteContext<"/api/salons/[slug]/queue">) => {
  const { slug } = await ctx.params;
  const actor = await requireUser("CLIENT");
  return ok(await joinQueue(actor.id, slug, (await readJson(request, joinQueueInput)).service), { status: 201 });
});

/** DELETE /api/salons/:slug/queue — la cliente quitte la file */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/salons/[slug]/queue">) => {
  const { slug } = await ctx.params;
  const actor = await requireUser("CLIENT");
  return ok(await leaveQueue(actor.id, slug));
});
