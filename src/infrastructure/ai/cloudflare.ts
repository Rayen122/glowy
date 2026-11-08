/**
 * Client de Cloudflare Workers AI (modèles d'image FLUX.2 de Black Forest Labs), utilisé par le rendu photoréaliste
 * de l'essai couleur. Offre gratuite : 10 000 « neurons » par jour (≈ 90 retouches avec FLUX.2 klein 4B), sans carte,
 * photos non conservées. Actif si CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_API_TOKEN (droit « Workers AI ») sont renseignés.
 */
import type { GeminiImage } from "./gemini";

/** FLUX.2 klein 4B : rapide (4 étapes) et le moins coûteux ; CLOUDFLARE_IMAGE_MODEL pour un autre, « off » pour couper */
export const cloudflareImageModel = () => process.env.CLOUDFLARE_IMAGE_MODEL?.trim() || "@cf/black-forest-labs/flux-2-klein-4b";
export const cloudflareImageEnabled = () =>
  process.env.NODE_ENV !== "test" &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim()) &&
  cloudflareImageModel() !== "off";

/** Quota du jour épuisé (10 000 neurons) ou trop de demandes : un autre fournisseur peut prendre le relais */
export class CloudflareQuotaError extends Error {
  name = "CloudflareQuotaError";
}

/** Type de l'image d'après ses premiers octets (le modèle renvoie du base64 sans type) */
const mimeOf = (base64: string) => (base64.startsWith("/9j/") ? "image/jpeg" : base64.startsWith("UklGR") ? "image/webp" : "image/png");

/**
 * Image retouchée par FLUX.2 d'après la consigne et la photo de référence (`input_image_0`, moins de 512 px de côté),
 * rendue en `width` × `height` (256 à 1920 px).
 */
export async function fluxEdit(prompt: string, image: GeminiImage, size: { width: number; height: number }, { timeoutMs = 60_000 } = {}): Promise<GeminiImage> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("input_image_0", new Blob([Buffer.from(image.data, "base64")], { type: image.mimeType }), "photo");
  form.append("width", String(size.width));
  form.append("height", String(size.height));
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID!.trim()}/ai/run/${cloudflareImageModel()}`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN!.trim()}` },
    body: form,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    const message = `Cloudflare ${response.status} : ${text.slice(0, 300)}`;
    throw response.status === 429 || /neurons|daily free allocation|capacity/i.test(text) ? new CloudflareQuotaError(message) : new Error(message);
  }
  const data = JSON.parse(text) as { result?: { image?: string } };
  const base64 = data.result?.image;
  if (!base64) throw new Error(`Cloudflare : aucune image rendue (${text.slice(0, 200)})`);
  return { mimeType: mimeOf(base64), data: base64 };
}
