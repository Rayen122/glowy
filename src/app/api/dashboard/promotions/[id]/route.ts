import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId, requireFeature } from "@/modules/dashboard";
import { deletePromotion, promotionInput, updatePromotion } from "@/modules/promotions";

/** PATCH /api/dashboard/promotions/:id — modification complète de la promotion */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/promotions/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "promotions");
  return ok(await updatePromotion(await currentSalonId(actor), id, await readJson(request, promotionInput)));
});

/** DELETE /api/dashboard/promotions/:id — supprimée, ou désactivée si elle a déjà servi */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/promotions/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "promotions");
  return ok(await deletePromotion(await currentSalonId(actor), id));
});
