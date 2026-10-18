import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { decidePayment, decidePaymentInput } from "@/modules/subscription";

/** PATCH /api/admin/payments/:id — { action: accept } ou { action: refuse, reason } (ADM-05) ; 409 ALREADY_DECIDED si déjà traité */
export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/payments/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await decidePayment(actor, id, await readJson(request, decidePaymentInput)));
});
