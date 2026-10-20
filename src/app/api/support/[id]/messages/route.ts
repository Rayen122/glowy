import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { replyToTicket, ticketMessageInput } from "@/modules/support";

/** POST /api/support/:id/messages — { text } : message de l'autrice ou réponse du support */
export const POST = route(async (request, ctx: RouteContext<"/api/support/[id]/messages">) => {
  const { id } = await ctx.params;
  const actor = await requireUser();
  return ok(await replyToTicket(actor, id, (await readJson(request, ticketMessageInput)).text), { status: 201 });
});
