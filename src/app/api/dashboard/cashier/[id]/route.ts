import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { invoiceDetail, voidInvoice, voidInvoiceInput } from "@/modules/dashboard";

/** GET /api/dashboard/cashier/:id — facture (équipe du salon, cliente concernée, Super Admin) */
export const GET = route(async (_request, ctx: RouteContext<"/api/dashboard/cashier/[id]">) => {
  const { id } = await ctx.params;
  return ok(await invoiceDetail(await requireUser(), id));
});

/** DELETE /api/dashboard/cashier/:id — { reason } : annulation de la facture par le gérant (avoir) */
export const DELETE = route(async (request, ctx: RouteContext<"/api/dashboard/cashier/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await voidInvoice(actor, id, (await readJson(request, voidInvoiceInput)).reason));
});
