import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { createCampaign, listCampaigns, pointCampaignInput } from "@/modules/loyalty";

/** GET /api/admin/loyalty/campaigns — campagnes « double points » (ADM-09) */
export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok(await listCampaigns());
});

/** POST /api/admin/loyalty/campaigns — { label, multiplier, startsOn, endsOn, reasons, active } */
export const POST = route(async (request) => {
  const actor = await requireUser("ADMIN");
  return ok(await createCampaign(actor.id, await readJson(request, pointCampaignInput)), { status: 201 });
});
