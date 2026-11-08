import { AppError } from "@/core/domain/errors";
import { cloudflareImageEnabled, cloudflareImageModel, CloudflareQuotaError, fluxEdit } from "@/infrastructure/ai/cloudflare";
import { editImage, GeminiQuotaError, imageEditEnabled, imageModel, type GeminiImage } from "@/infrastructure/ai/gemini";
import type { TryOnProInput } from "../application/schemas";
import { closestAspectRatio, fluxSize, proColorPrompt } from "../domain/pro-render";

/**
 * Bouton « Rendu photoréaliste » affiché : au moins un modèle d'image configuré —
 * FLUX.2 sur Cloudflare Workers AI (gratuit, ~90 rendus par jour), puis Gemini (payant : aucune image dans son offre
 * gratuite) en secours
 */
export const proRenderEnabled = () => cloudflareImageEnabled() || imageEditEnabled();

const unavailable = () => new AppError(503, "TRY_ON_UNAVAILABLE", "Rendu photoréaliste indisponible pour le moment.");
const blob = (dataUrl: string): GeminiImage => {
  const [, mimeType, data] = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/)!;
  return { mimeType, data };
};

type Provider = { name: string; run: () => Promise<GeminiImage | "blocked"> };

/** Fournisseur au quota épuisé : mis de côté 15 min, pour ne pas perdre un appel (et du temps) à chaque rendu */
const QUOTA_PAUSE_MS = 15 * 60_000;
const pausedUntil = new Map<string, number>();

/**
 * Essai couleur, rendu photoréaliste : la photo est retouchée par un modèle d'image (cheveux seuls), puis oubliée.
 * Fournisseurs essayés dans l'ordre (gratuit d'abord) ; quota épuisé chez l'un → le suivant, et celui-ci est sauté 15 min. Aucun disponible : 503,
 * l'aperçu instantané reste utilisable. Le navigateur ne garde du rendu que les cheveux (visage et décor d'origine).
 */
export async function proHairColor(input: TryOnProInput) {
  const prompt = proColorPrompt(input.shade);
  const providers: Provider[] = [
    ...(cloudflareImageEnabled() ? [{ name: cloudflareImageModel(), run: () => fluxEdit(prompt, blob(input.small), fluxSize(input.width, input.height)) }] : []),
    ...(imageEditEnabled() ? [{ name: imageModel(), run: () => editImage(prompt, blob(input.image), { aspectRatio: closestAspectRatio(input.width, input.height) }) }] : []),
  ].filter((provider) => (pausedUntil.get(provider.name) ?? 0) <= Date.now());
  if (!providers.length) throw unavailable();
  let failed = false;
  for (const provider of providers) {
    try {
      const result = await provider.run();
      if (result === "blocked") throw new AppError(422, "TRY_ON_BLOCKED", "Cette photo ne peut pas être retouchée.");
      return { image: `data:${result.mimeType};base64,${result.data}`, shade: input.shade };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof CloudflareQuotaError || error instanceof GeminiQuotaError) {
        pausedUntil.set(provider.name, Date.now() + QUOTA_PAUSE_MS);
        console.warn(`[essai couleur] ${provider.name} : quota atteint ou offre sans génération d'images (mis de côté 15 min).`, error.message);
      } else {
        failed = true;
        console.warn(`[essai couleur] ${provider.name} : rendu impossible.`, (error as Error).message);
      }
    }
  }
  throw failed ? new AppError(502, "TRY_ON_FAILED", "Le rendu n'a pas abouti. Réessayez dans un instant.") : unavailable();
}
