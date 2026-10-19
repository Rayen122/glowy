import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { deleteClientNote } from "@/modules/dashboard";

/** DELETE /api/dashboard/notes/:id — supprime une note du salon */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/notes/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await deleteClientNote(actor, id));
});
