import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { addLeave, leaveInput } from "@/modules/dashboard";

/** POST /api/dashboard/team/:id/leaves — { from, to, label } : congé sur des journées entières ; 409 si un RDV tombe dedans */
export const POST = route(async (request, ctx: RouteContext<"/api/dashboard/team/[id]/leaves">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await addLeave(actor, id, await readJson(request, leaveInput)), { status: 201 });
});
