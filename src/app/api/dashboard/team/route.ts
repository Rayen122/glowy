import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { createEmployee, employeeInput, listTeam, staffSalon } from "@/modules/dashboard";

/** GET /api/dashboard/team — équipe du salon (SAL-05) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await listTeam((await staffSalon(actor)).id));
});

/** POST /api/dashboard/team — nouveau professionnel */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await createEmployee(actor, await readJson(request, employeeInput)), { status: 201 });
});
