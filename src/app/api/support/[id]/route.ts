import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { setTicketStatus, ticketStatusInput, ticketThread } from "@/modules/support";

/** GET /api/support/:id — conversation (autrice du ticket ou Super Admin) */
export const GET = route(async (_request, ctx: RouteContext<"/api/support/[id]">) => {
  const { id } = await ctx.params;
  return ok(await ticketThread(await requireUser(), id));
});

/** PATCH /api/support/:id — { status: OPEN | CLOSED } : fermer ou rouvrir */
export const PATCH = route(async (request, ctx: RouteContext<"/api/support/[id]">) => {
  const { id } = await ctx.params;
  return ok(await setTicketStatus(await requireUser(), id, (await readJson(request, ticketStatusInput)).status));
});
