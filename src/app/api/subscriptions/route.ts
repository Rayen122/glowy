import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { staffSalonId } from "@/modules/identity";
import { requestPlan, requestPlanInput, salonSubscription } from "@/modules/subscription";

/** GET /api/subscriptions — plan en cours, échéance, demande en attente et historique du salon du gérant */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER");
  return ok(await salonSubscription(await staffSalonId(actor)));
});

/**
 * POST /api/subscriptions — { plan: pro | premium, channel: VIREMENT | D17 | ESPECES, reference, note? }
 * Le gérant déclare son paiement ; le plan s'active après acceptation par le Super Admin (409 PENDING_EXISTS, ALREADY_ACTIVE).
 */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER");
  return ok(await requestPlan(actor, await readJson(request, requestPlanInput)), { status: 201 });
});
