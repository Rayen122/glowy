import { notFound } from "@/core/domain/errors";
import { ok, route } from "@/infrastructure/http";
import { getSalonDetail } from "@/modules/catalog";
import { currentUser } from "@/infrastructure/session";

/** GET /api/salons/:slug — fiche salon : services, équipe, horaires, avis vérifiés (RES-02) */
export const GET = route(async (_request, ctx: RouteContext<"/api/salons/[slug]">) => {
  const { slug } = await ctx.params;
  const user = await currentUser();
  const detail = await getSalonDetail(slug, user?.id);
  if (!detail) throw notFound("Salon introuvable.");
  return ok(detail);
});
