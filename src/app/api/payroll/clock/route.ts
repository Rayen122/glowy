import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { clock, clockInput } from "@/modules/payroll";

/** POST /api/payroll/clock — { action: "in" | "out" } : arrivée ou départ du professionnel connecté ; 409 ALREADY_IN / NOT_IN */
export const POST = route(async (request) => {
  const actor = await requireUser("EMPLOYEE");
  const { action } = await readJson(request, clockInput);
  return ok(await clock(actor.id, action));
});
