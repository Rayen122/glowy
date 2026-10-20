import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { salonPointsInput, salonPointsOverview, setSalonPointsPerVisit } from "@/modules/promotions";

/** GET /api/dashboard/salon-points — points par visite, clientes membres, points en circulation (FID-06) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await salonPointsOverview(await currentSalonId(actor)));
});

/** PATCH /api/dashboard/salon-points — { perVisit } (0 désactive le programme) */
export const PATCH = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  const { perVisit } = await readJson(request, salonPointsInput);
  return ok(await setSalonPointsPerVisit(await currentSalonId(actor), perVisit));
});
