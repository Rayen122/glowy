import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { joinWaitlist, waitlistInput } from "@/modules/booking";

/** POST /api/salons/:slug/waitlist — { date, serviceKeys } : liste d'attente d'un jour complet (RES-09) */
export const POST = route(async (request, ctx: RouteContext<"/api/salons/[slug]/waitlist">) => {
  const { slug } = await ctx.params;
  const actor = await requireUser("CLIENT");
  return ok(await joinWaitlist(actor.id, slug, await readJson(request, waitlistInput)), { status: 201 });
});
