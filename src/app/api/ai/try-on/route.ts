import { ok, readJson, route } from "@/infrastructure/http";
import { clientIp, rateLimit } from "@/infrastructure/rate-limit";
import { currentActor } from "@/infrastructure/session";
import { proHairColor, tryOnProInput } from "@/modules/beauty";

/** Génération d'une image : jusqu'à ~30 s */
export const maxDuration = 60;

/**
 * POST /api/ai/try-on — { shade, image, width, height } → { image, shade } : rendu photoréaliste de l'essai couleur
 * (Gemini, modèle d'image). Envoi seulement à la demande de la cliente ; photo transmise puis oubliée.
 * Chaque rendu est facturé : 6 par 10 min et 20 par jour par personne, 300 par jour pour toute la plateforme.
 */
export const POST = route(async (request) => {
  const input = await readJson(request, tryOnProInput);
  const actor = await currentActor();
  rateLimit("tryOn", actor?.id ?? clientIp(request));
  rateLimit("tryOnBudget", "all");
  return ok(await proHairColor(input));
});
