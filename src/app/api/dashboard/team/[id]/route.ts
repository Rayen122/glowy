import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { deleteEmployee, employeeInput, updateEmployee } from "@/modules/dashboard";

/** PATCH /api/dashboard/team/:id — modifier un professionnel et ses horaires */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/team/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updateEmployee(actor, id, await readJson(request, employeeInput)));
});

/** DELETE /api/dashboard/team/:id — supprime, ou désactive s'il a un historique ; 409 HAS_BOOKINGS s'il a des RDV à venir */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/team/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await deleteEmployee(actor, id));
});
