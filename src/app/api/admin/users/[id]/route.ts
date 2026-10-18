import { setUserStatus, userActionInput } from "@/modules/admin";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/** PATCH /api/admin/users/:id — { action: block | unblock } (ADM-04) */
export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/users/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await setUserStatus(actor, id, await readJson(request, userActionInput)));
});
