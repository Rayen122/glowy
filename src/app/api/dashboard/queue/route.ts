import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { addWalkIn, salonQueue, walkInInput } from "@/modules/affluence";
import { currentSalonId } from "@/modules/dashboard";

/** GET /api/dashboard/queue — file d'attente du salon (RES-08) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await salonQueue(await currentSalonId(actor)));
});

/** POST /api/dashboard/queue — { name, service? } : cliente de passage ajoutée par l'équipe */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { name, service } = await readJson(request, walkInInput);
  return ok(await addWalkIn(await currentSalonId(actor), name, service), { status: 201 });
});
