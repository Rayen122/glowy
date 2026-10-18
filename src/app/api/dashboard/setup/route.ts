import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { setupSalon } from "@/modules/dashboard";

/** POST /api/dashboard/setup — horaires par défaut (lun–sam 9 h–19 h) et gérant comme premier professionnel, sans rien écraser */
export const POST = route(async () => {
  const actor = await requireUser("MANAGER");
  return ok(await setupSalon(actor, `${actor.firstName} ${actor.lastName}`.trim()));
});
