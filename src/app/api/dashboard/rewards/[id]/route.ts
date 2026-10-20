import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { deleteSalonReward, salonRewardInput, updateSalonReward } from "@/modules/promotions";

/** PATCH /api/dashboard/rewards/:id — { label, cost, active } */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/rewards/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updateSalonReward(await currentSalonId(actor), id, await readJson(request, salonRewardInput)));
});

/** DELETE /api/dashboard/rewards/:id — supprimée, ou désactivée si des codes ont déjà été émis */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/rewards/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await deleteSalonReward(await currentSalonId(actor), id));
});
