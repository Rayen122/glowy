import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { payslipFor, payslipUpdateInput, updatePayslip } from "@/modules/payroll";

/** GET /api/payroll/payslips/:id — une fiche : le gérant du salon, ou le professionnel concerné une fois validée */
export const GET = route(async (_request, ctx: RouteContext<"/api/payroll/payslips/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await payslipFor(actor, id));
});

/** PATCH /api/payroll/payslips/:id — { bonus?, advance?, note?, action } : brouillon ajusté, recalculé ou validé ; 409 PAYSLIP_VALIDATED */
export const PATCH = route(async (request, ctx: RouteContext<"/api/payroll/payslips/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updatePayslip(actor, id, await readJson(request, payslipUpdateInput)));
});
