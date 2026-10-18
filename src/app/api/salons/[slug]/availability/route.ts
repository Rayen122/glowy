import { ok, readQuery, route } from "@/infrastructure/http";
import { availabilityForSalon, availabilityQuery } from "@/modules/booking";

/**
 * GET /api/salons/:slug/availability?date=AAAA-MM-JJ&services=cle1,cle2&employee=cle
 * Créneaux de la journée (pas de 30 min) avec les employés libres pour la durée des prestations.
 */
export const GET = route(async (request, ctx: RouteContext<"/api/salons/[slug]/availability">) => {
  const { slug } = await ctx.params;
  return ok(await availabilityForSalon(slug, readQuery(request, availabilityQuery)));
});
