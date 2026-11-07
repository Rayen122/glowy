import { ok, readJson, route } from "@/infrastructure/http";
import { clientIp, rateLimit } from "@/infrastructure/rate-limit";
import { currentActor } from "@/infrastructure/session";
import { beautyAnalysis, beautyInput } from "@/modules/beauty";

/**
 * POST /api/ai/beauty — { mode, metrics } → diagnostic (IA P5) : points d'attention, soins proposés.
 * Les mesures sont calculées dans le navigateur : la photo n'est jamais envoyée. Cliente connectée :
 * résultat enregistré et points crédités une fois par mois. Repli : demande d'une nouvelle photo.
 */
export const POST = route(async (request) => {
  const { mode, metrics } = await readJson(request, beautyInput);
  const actor = await currentActor();
  rateLimit("ai", actor?.id ?? clientIp(request));
  return ok(await beautyAnalysis(actor?.role === "CLIENT" ? actor.id : null, mode, metrics));
});
