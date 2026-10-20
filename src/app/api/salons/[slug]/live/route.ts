import { notFound } from "@/core/domain/errors";
import { idOf, Salon } from "@/infrastructure/db";
import { ok, route } from "@/infrastructure/http";
import { currentActor } from "@/infrastructure/session";
import { liveAffluence, myQueueStatus, salonOpenNow } from "@/modules/affluence";

/** GET /api/salons/:slug/live — affluence en direct, file d'attente et place de la cliente connectée (RES-08) */
export const GET = route(async (_request, ctx: RouteContext<"/api/salons/[slug]/live">) => {
  const { slug } = await ctx.params;
  const salon = await Salon.findOne({ slug, status: "ACTIVE" }, { _id: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  const actor = await currentActor();
  const [live, open, mine] = await Promise.all([liveAffluence([idOf(salon)]), salonOpenNow(slug), myQueueStatus(actor?.role === "CLIENT" ? actor.id : null, slug)]);
  return ok({ ...live.get(idOf(salon))!, open, mine });
});
