import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId, moveStock, stockMoveInput } from "@/modules/dashboard";

/** POST /api/dashboard/stocks/:id/moves — { delta, reason: IN|OUT|SALE|ADJUST, note? } (toute l'équipe) */
export const POST = route(async (request, ctx: RouteContext<"/api/dashboard/stocks/[id]/moves">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await moveStock(actor, await currentSalonId(actor), id, await readJson(request, stockMoveInput)), { status: 201 });
});
