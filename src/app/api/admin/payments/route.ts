import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { adminSubscriptions } from "@/modules/subscription";

/** GET /api/admin/payments — paiements d'abonnement à valider, historique, revenus et plans actifs (ADM-05) */
export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok(await adminSubscriptions());
});
