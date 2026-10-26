import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { addClientNote, clientNoteInput, requireFeature } from "@/modules/dashboard";

/** POST /api/dashboard/clients/:id/notes — { kind, text } : note du salon sur une cliente (SAL-08) */
export const POST = route(async (request, ctx: RouteContext<"/api/dashboard/clients/[id]/notes">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  await requireFeature(actor, "crm");
  return ok(await addClientNote(actor, id, await readJson(request, clientNoteInput)), { status: 201 });
});
