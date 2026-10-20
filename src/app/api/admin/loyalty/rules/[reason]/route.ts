import type { PointReason } from "@/core/domain/enums";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { pointRuleInput, updatePointRule } from "@/modules/loyalty";

/** PATCH /api/admin/loyalty/rules/:reason — { points, active, monthlyCap, dailyCap } : barème (ADM-09), journalisé */
export const PATCH = route(async (request, ctx: RouteContext<"/api/admin/loyalty/rules/[reason]">) => {
  const { reason } = await ctx.params;
  const actor = await requireUser("ADMIN");
  return ok(await updatePointRule(actor.id, reason as PointReason, await readJson(request, pointRuleInput)));
});
