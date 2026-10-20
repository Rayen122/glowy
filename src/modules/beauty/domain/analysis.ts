/**
 * IA P5 — analyse beauté par photo. Fonctions pures, partagées par le navigateur et le serveur :
 * - measure() calcule des mesures d'image à partir des pixels (dans le navigateur : la photo ne quitte jamais l'appareil) ;
 * - diagnose() applique des règles explicables (seuils) et renvoie points d'attention, conseils et soins à chercher.
 * Indicatif, pas un diagnostic médical. Repli : photo trop sombre ou floue → demande d'une nouvelle photo.
 */

export type BeautyMode = "cheveux" | "visage";
export type Metrics = {
  /** Luminosité moyenne (0–1) */
  brightness: number;
  /** Écart type de la luminosité (homogénéité) */
  contrast: number;
  /** Saturation moyenne (0–1) */
  saturation: number;
  /** Part de reflets (pixels très clairs et peu saturés) */
  highlights: number;
  /** Dominante rouge au centre de l'image */
  redness: number;
  /** Énergie des détails fins (laplacien moyen) : texture, frisottis, netteté */
  sharpness: number;
  /** Luminosité du tiers bas moins celle du tiers haut (pointes vs racines) */
  topBottomDelta: number;
};

export const HAIR_ISSUES = ["dullHair", "frizz", "dryEnds", "roots"] as const;
export const FACE_ISSUES = ["redness", "shine", "uneven", "dull", "pores", "dehydration"] as const;
export type IssueKey = (typeof HAIR_ISSUES)[number] | (typeof FACE_ISSUES)[number];
export type Level = "moderate" | "light";

/** Termes cherchés dans les noms des prestations des salons, par point d'attention (ordre de préférence) */
export const SERVICE_TERMS: Record<IssueKey | "healthyHair" | "healthyFace", string[]> = {
  dullHair: ["kératine", "soin", "brillance"],
  frizz: ["kératine", "lissage", "soin"],
  dryEnds: ["coupe + soin", "soin", "coupe"],
  roots: ["racines", "coloration", "balayage"],
  redness: ["apaisant", "soin hydratant", "soin"],
  shine: ["purifiant", "nettoyage", "soin"],
  uneven: ["éclat", "peeling", "soin"],
  dull: ["éclat", "hydrafacial", "soin"],
  pores: ["nettoyage", "purifiant", "hydrafacial"],
  dehydration: ["hydratant", "hydrafacial", "soin"],
  healthyHair: ["soin", "brushing"],
  healthyFace: ["soin", "hydratant"],
};

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
function saturationOf(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/** Mesures d'une image RGBA (largeur × hauteur), idéalement réduite à ~128 px de côté */
export function measure(rgba: Uint8ClampedArray | number[], width: number, height: number): Metrics {
  const n = width * height;
  const lum = new Float32Array(n);
  let sumL = 0;
  let sumS = 0;
  let highlights = 0;
  let redSum = 0;
  let redCount = 0;
  for (let i = 0; i < n; i += 1) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const l = luminance(r, g, b);
    const s = saturationOf(r, g, b);
    lum[i] = l;
    sumL += l;
    sumS += s;
    if (l > 0.9 && s < 0.15) highlights += 1;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75) {
      redSum += (r - (g + b) / 2) / 255;
      redCount += 1;
    }
  }
  const brightness = sumL / n;
  let variance = 0;
  for (let i = 0; i < n; i += 1) variance += (lum[i] - brightness) ** 2;
  let lap = 0;
  let lapCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      lap += Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - width] - lum[i + width]);
      lapCount += 1;
    }
  }
  const third = Math.floor(height / 3);
  const band = (from: number, to: number) => {
    let s = 0;
    for (let y = from; y < to; y += 1) for (let x = 0; x < width; x += 1) s += lum[y * width + x];
    return s / Math.max(1, (to - from) * width);
  };
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    brightness: round(brightness),
    contrast: round(Math.sqrt(variance / n)),
    saturation: round(sumS / n),
    highlights: round(highlights / n),
    redness: round(redCount ? redSum / redCount : 0),
    sharpness: round(lapCount ? lap / lapCount : 0),
    topBottomDelta: round(height >= 3 ? band(height - third, height) - band(0, third) : 0),
  };
}

export type Diagnosis =
  | { kind: "retake"; reason: "dark" | "blurry" | "overexposed" }
  | { kind: "result"; score: number; healthy: boolean; issues: { key: IssueKey; level: Level }[]; terms: string[] };

/** Règles explicables, seuils fixés sur des photos d'essai en lumière naturelle */
export function diagnose(mode: BeautyMode, m: Metrics): Diagnosis {
  if (m.brightness < 0.15) return { kind: "retake", reason: "dark" };
  if (m.brightness > 0.92) return { kind: "retake", reason: "overexposed" };
  if (m.sharpness < 0.008) return { kind: "retake", reason: "blurry" };

  const issues: { key: IssueKey; level: Level }[] = [];
  const add = (key: IssueKey, moderate: boolean) => issues.push({ key, level: moderate ? "moderate" : "light" });
  if (mode === "cheveux") {
    if (m.highlights < 0.01 && m.brightness < 0.55) add("dullHair", m.highlights < 0.003);
    if (m.sharpness > 0.09) add("frizz", m.sharpness > 0.14);
    if (m.topBottomDelta > 0.08) add("dryEnds", m.topBottomDelta > 0.15);
    if (m.topBottomDelta < -0.12) add("roots", m.topBottomDelta < -0.2);
  } else {
    if (m.redness > 0.12) add("redness", m.redness > 0.2);
    if (m.highlights > 0.03) add("shine", m.highlights > 0.08);
    if (m.contrast > 0.2) add("uneven", m.contrast > 0.28);
    if (m.brightness < 0.4 && m.saturation < 0.25) add("dull", m.brightness < 0.3);
    if (m.sharpness > 0.1) add("pores", m.sharpness > 0.15);
    if (m.saturation < 0.18 && m.highlights < 0.005) add("dehydration", m.saturation < 0.12);
  }
  const top = issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "moderate" ? -1 : 1)).slice(0, 3);
  const score = Math.max(40, 100 - top.reduce((s, i) => s + (i.level === "moderate" ? 14 : 7), 0));
  const terms = [...new Set((top.length ? top.map((i) => i.key) : [mode === "cheveux" ? "healthyHair" : "healthyFace"]).flatMap((k) => SERVICE_TERMS[k as keyof typeof SERVICE_TERMS]))];
  return { kind: "result", score, healthy: top.length === 0, issues: top, terms };
}
