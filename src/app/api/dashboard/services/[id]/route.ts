import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { deleteService, serviceInput, updateService } from "@/modules/dashboard";

/** PATCH /api/dashboard/services/:id — modifier une prestation (SAL-03) */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/services/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updateService(actor, id, await readJson(request, serviceInput)));
});

/** DELETE /api/dashboard/services/:id */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/services/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await deleteService(actor, id));
});
