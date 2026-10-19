import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { createService, listSalonServices, serviceInput, staffSalon } from "@/modules/dashboard";

/** GET /api/dashboard/services — prestations du salon (SAL-03) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await listSalonServices((await staffSalon(actor)).id));
});

/** POST /api/dashboard/services — nouvelle prestation ; 409 SERVICE_EXISTS si le nom est déjà pris */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await createService(actor, await readJson(request, serviceInput)), { status: 201 });
});
