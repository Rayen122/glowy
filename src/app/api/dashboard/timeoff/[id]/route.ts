import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { unblockSlot } from "@/modules/dashboard";

/** DELETE /api/dashboard/timeoff/:id — retire un blocage de l'agenda */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/timeoff/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await unblockSlot(actor, id));
});
