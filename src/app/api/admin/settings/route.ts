import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { getPlatformSettings, platformSettingsInput, updatePlatformSettings } from "@/modules/platform";

/** GET /api/admin/settings — catalogue global, langues et commissions (ADM-05, ADM-06) */
export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok(await getPlatformSettings());
});

/** PATCH /api/admin/settings — une ou plusieurs sections : cities, categories, serviceGroups, locales, commissions */
export const PATCH = route(async (request) => {
  const actor = await requireUser("ADMIN");
  return ok(await updatePlatformSettings(actor.id, await readJson(request, platformSettingsInput)));
});
