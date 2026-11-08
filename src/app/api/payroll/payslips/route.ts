import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { generateForActor, generateInput } from "@/modules/payroll";

/** POST /api/payroll/payslips — { period: "AAAA-MM" } : crée ou recalcule les brouillons du mois (fiches validées inchangées) */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  const { period } = await readJson(request, generateInput);
  return ok(await generateForActor(actor, period));
});
