/**
 * Module Modération — IA de filtrage des contenus publics.
 * Texte (avis, réponses) : gros mots masqués « *** », y compris en derja tunisienne et en arabizi.
 * Photos (salon, avis, profil) : refusées si inappropriées (nudité, violence…).
 * Lexique local toujours actif ; modèle Gemini en plus si GEMINI_API_KEY est configurée.
 * Si Gemini est injoignable (quota, réseau), on ne bloque jamais l'utilisateur : repli sur le lexique, photo acceptée.
 */
import { badRequest } from "@/core/domain/errors";
import { maskProfanity } from "./domain/profanity";
import { geminiEnabled, imageVerdict, offensiveWords } from "./infrastructure/gemini";

export async function cleanText(text: string) {
  let extra: string[] = [];
  if (geminiEnabled()) {
    try {
      extra = await offensiveWords(text);
    } catch (error) {
      console.warn("[modération] Gemini indisponible, lexique local seul :", (error as Error).message);
    }
  }
  return maskProfanity(text, extra).text;
}

export async function assertSafeImage(bytes: Uint8Array, contentType: string) {
  if (!geminiEnabled()) return;
  try {
    const verdict = await imageVerdict(bytes, contentType);
    if (verdict.safe) return;
    console.info(`[modération] photo refusée (${verdict.category}) : ${verdict.reason ?? ""}`);
  } catch (error) {
    console.warn("[modération] Gemini indisponible, photo acceptée sans vérification :", (error as Error).message);
    return;
  }
  throw badRequest("PHOTO_REFUSED", "Photo refusée : son contenu n'est pas autorisé sur Glowy.");
}

export { isProfane, maskProfanity } from "./domain/profanity";
export { geminiEnabled } from "./infrastructure/gemini";
