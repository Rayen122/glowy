import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId, deleteProduct, productInput, requireFeature, updateProduct } from "@/modules/dashboard";

/** PATCH /api/dashboard/stocks/:id — fiche produit (la quantité ne change que par des mouvements) */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/stocks/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stocks");
  return ok(await updateProduct(await currentSalonId(actor), id, await readJson(request, productInput)));
});

/** DELETE /api/dashboard/stocks/:id — supprimé, ou désactivé s'il a déjà des mouvements */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/stocks/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stocks");
  return ok(await deleteProduct(await currentSalonId(actor), id));
});
