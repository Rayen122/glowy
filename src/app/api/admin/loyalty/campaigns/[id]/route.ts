import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { campaignToggleInput, deleteCampaign, setCampaignActive } from "@/modules/loyalty";

/** PATCH /api/admin/loyalty/campaigns/:id — { active } : met en pause ou relance la campagne */
export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/loyalty/campaigns/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await setCampaignActive(actor.id, id, (await readJson(request, campaignToggleInput)).active));
});

/** DELETE /api/admin/loyalty/campaigns/:id */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/admin/loyalty/campaigns/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await deleteCampaign(actor.id, id));
});
