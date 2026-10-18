import { salonActionInput, setSalonStatus } from "@/modules/admin";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/** PATCH /api/admin/salons/:id — { action: approve | reject | suspend | reactivate, reason? } (ADM-02, ADM-03) */
export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/salons/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await setSalonStatus(actor, id, await readJson(request, salonActionInput)));
});
