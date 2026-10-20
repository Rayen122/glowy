import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { queueAction, queueActionInput } from "@/modules/affluence";
import { currentSalonId } from "@/modules/dashboard";

/** PATCH /api/dashboard/queue/:id — { action: call | serve | noShow | remove } */
export const PATCH = route(async (request, ctx: RouteContext<"/api/dashboard/queue/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await queueAction(actor, await currentSalonId(actor), id, (await readJson(request, queueActionInput)).action));
});
