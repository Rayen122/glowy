import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { createEmployeeAccount, employeeAccountInput, revokeEmployeeAccount } from "@/modules/dashboard";

/** POST /api/dashboard/team/:id/account — { email } : crée le compte de l'employé (AUTH-07), renvoie le mot de passe temporaire */
export const POST = route(async (request, ctx: RouteContext<"/api/dashboard/team/[id]/account">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  const { email } = await readJson(request, employeeAccountInput);
  return ok(await createEmployeeAccount(actor, id, email), { status: 201 });
});

/** DELETE /api/dashboard/team/:id/account — retire l'accès de l'employé */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/dashboard/team/[id]/account">) => {
  const { id } = await ctx.params;
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await revokeEmployeeAccount(actor, id));
});
