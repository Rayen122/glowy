import { getLoyaltySummary } from "@/modules/loyalty";
import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/** GET /api/me/loyalty — solde, niveau, historique et catalogue de récompenses (FID-01, FID-03, FID-04) */
export const GET = route(async () => {
  const user = await requireUser("CLIENT");
  return ok(await getLoyaltySummary(user.id));
});
