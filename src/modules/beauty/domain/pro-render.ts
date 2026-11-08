import type { ShadeId } from "./try-on";

/**
 * Essai couleur, rendu photoréaliste : consigne donnée au modèle d'édition d'image (Gemini) pour recolorer
 * les cheveux sans toucher au reste de la photo. Fonctions pures, testées.
 */

/**
 * Teinte décrite avec les mots d'un coloriste : sans code couleur, que les modèles d'image appliquent trop saturé
 * (un auburn devenait rouge vif) — essais du 8 novembre 2026 sur FLUX.2 klein
 */
const SHADE_WORDS: Record<ShadeId, string> = {
  ebony: "a natural deep black, soft black-brown",
  chocolate: "a rich dark chocolate brown",
  hazelnut: "a medium hazelnut brown",
  ash: "a cool light ash blonde, beige-grey without any yellow",
  caramel: "a warm caramel brown with golden tones",
  honey: "a soft golden honey blonde",
  copper: "a bright natural copper, warm orange-red",
  auburn: "a natural auburn, a deep reddish-brown",
  platinum: "an icy platinum blonde, almost white",
  rosegold: "rose gold, a soft pastel pink blonde",
  burgundy: "a deep burgundy, dark wine red",
  plum: "a dark plum, deep violet-brown",
};

export function proColorPrompt(shade: ShadeId) {
  return [
    `Change only the hair color of the person to ${SHADE_WORDS[shade]}, like a real hair dye result done in a professional salon.`,
    "Same haircut, hairstyle, hairline, strands, texture, shine, highlights and shadows.",
    "Do not change the face, skin, eyes, eyebrows, beard, makeup, expression, clothes, background, lighting or framing. Photorealistic.",
  ].join(" ");
}

/** Formats acceptés par le modèle d'image */
export const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;

/** Format le plus proche de la photo (écart des logarithmes des rapports) : le rendu garde le cadrage d'origine */
export function closestAspectRatio(width: number, height: number) {
  const target = Math.log(width / height);
  const distance = (ratio: string) => {
    const [w, h] = ratio.split(":").map(Number);
    return Math.abs(Math.log(w / h) - target);
  };
  return ASPECT_RATIOS.reduce((best, ratio) => (distance(ratio) < distance(best) ? ratio : best));
}

/** Photo de référence pour FLUX.2 (Cloudflare) : moins de 512 px de côté */
export const REFERENCE_MAX = 504;

/** Taille du rendu FLUX.2 : cadrage de la photo, 1024 px au plus, côtés multiples de 16 (256 à 1920 px) */
export function fluxSize(width: number, height: number) {
  const scale = 1024 / Math.max(width, height);
  const side = (v: number) => Math.min(1920, Math.max(256, Math.round((v * scale) / 16) * 16));
  return { width: side(width), height: side(height) };
}
