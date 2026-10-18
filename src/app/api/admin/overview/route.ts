import { adminOverview } from "@/modules/admin";
import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/** GET /api/admin/overview — chiffres clés, salons en attente, journal d'audit (ADM-01) */
export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok(await adminOverview());
});
