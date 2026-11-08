import { ok, readJson, route } from "@/infrastructure/http";
import { clientIp, rateLimit } from "@/infrastructure/rate-limit";
import { currentActor } from "@/infrastructure/session";
import { getLocale } from "@/i18n/server";
import { beautyAnalysis, beautyInput } from "@/modules/beauty";

/**
 * POST /api/ai/beauty — { mode, metrics, image? } → diagnostic (IA P5) : points d'attention, soins proposés.
 * La photo (réduite) est regardée par le modèle de vision Gemini puis oubliée ; les mesures du navigateur servent de
 * contrôle de qualité et de secours. Cliente connectée : résultat enregistré (sans la photo), points une fois par mois.
 */
export const POST = route(async (request) => {
  const { mode, metrics, image } = await readJson(request, beautyInput);
  const actor = await currentActor();
  rateLimit("ai", actor?.id ?? clientIp(request));
  return ok(await beautyAnalysis(actor?.role === "CLIENT" ? actor.id : null, mode, metrics, { image, lang: await getLocale() }));
});
