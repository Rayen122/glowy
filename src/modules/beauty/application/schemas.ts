import { z } from "zod";
import { HAIR_SHADES, type ShadeId } from "../domain/try-on";

const unit = z.coerce.number().min(0).max(1);
const signed = z.coerce.number().min(-1).max(1);

/**
 * Mesures calculées dans le navigateur (contrôle de qualité, secours) et photo réduite à 768 px pour le modèle de vision,
 * envoyée après consentement, analysée puis oubliée (jamais enregistrée)
 */
export const beautyInput = z.object({
  mode: z.enum(["cheveux", "visage"]),
  metrics: z.object({ brightness: unit, contrast: unit, saturation: unit, highlights: unit, redness: signed, sharpness: unit, topBottomDelta: signed }),
  image: z.string().max(900_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/).optional(),
});

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * Rendu photoréaliste de l'essai couleur, envoyé à la demande de la cliente, transmis au modèle d'image puis oublié
 * (jamais enregistré) : `image` = photo de travail (1024 px au plus, JPEG) pour Gemini, `small` = la même en moins
 * de 512 px pour FLUX.2 (Cloudflare) ; largeur et hauteur pour garder le cadrage
 */
export const tryOnProInput = z.object({
  shade: z.enum(HAIR_SHADES.map((s) => s.id) as [ShadeId, ...ShadeId[]]),
  image: z.string().max(2_000_000).regex(DATA_URL),
  small: z.string().max(600_000).regex(DATA_URL),
  width: z.coerce.number().int().min(64).max(4096),
  height: z.coerce.number().int().min(64).max(4096),
});
export type TryOnProInput = z.infer<typeof tryOnProInput>;
