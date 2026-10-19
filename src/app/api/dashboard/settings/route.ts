import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { salonSettings, salonSettingsInput, staffSalon, updateSalonSettings } from "@/modules/dashboard";

/** GET /api/dashboard/settings — profil et règles du salon (SAL-02, SAL-07) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await salonSettings((await staffSalon(actor)).id));
});

/** PATCH /api/dashboard/settings — met à jour une ou plusieurs sections */
export const PATCH = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updateSalonSettings(actor, await readJson(request, salonSettingsInput)));
});
