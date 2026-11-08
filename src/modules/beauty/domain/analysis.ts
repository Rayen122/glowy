/**
 * IA P5 — analyse beauté par photo. Fonctions pures, partagées par le navigateur et le serveur :
 * - measure() calcule des mesures d'image à partir des pixels, dans le navigateur (contrôle de qualité avant tout envoi) ;
 * - le modèle d'IA (Gemini Vision, voir infrastructure/vision) regarde la photo ; fromVision() valide sa lecture ;
 * - diagnose() applique des règles explicables (seuils) : secours quand le modèle n'est pas disponible.
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
  /** Rougeur au centre de l'image : teinte plus rouge que celle d'une peau normale (0 = aucune, 0,5 au plus) */
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

/** Composantes a* (vert → rouge) et b* (bleu → jaune) de l'espace CIELAB, illuminant D65 */
function labAB(r: number, g: number, b: number) {
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return { a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/**
 * Toute peau est plus rouge que verte : la rougeur se lit dans la teinte, pas dans le rouge brut.
 * Angle de teinte CIELAB (atan2(b*, a*)) : 51 à 63° pour les peaux normales, de très claire à très foncée ;
 * 31 à 38° pour une peau irritée ou un coup de soleil. Indice = écart sous 55°, ignoré si la couleur est trop grise.
 */
const SKIN_HUE = 55;
function rednessOf(r: number, g: number, b: number) {
  const lab = labAB(r, g, b);
  if (lab.a <= 0 || Math.hypot(lab.a, lab.b) < 8) return 0;
  const hue = Math.max(0, (Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return Math.min(0.5, Math.max(0, (SKIN_HUE - hue) / 100));
}

/** Mesures d'une image RGBA (largeur × hauteur), idéalement réduite à ~128 px de côté */
export function measure(rgba: Uint8ClampedArray | number[], width: number, height: number): Metrics {
  const n = width * height;
  const lum = new Float32Array(n);
  let sumL = 0;
  let sumS = 0;
  let highlights = 0;
  const center = [0, 0, 0];
  let centerCount = 0;
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
      center[0] += r;
      center[1] += g;
      center[2] += b;
      centerCount += 1;
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
    redness: round(centerCount ? rednessOf(center[0] / centerCount, center[1] / centerCount, center[2] / centerCount) : 0),
    sharpness: round(lapCount ? lap / lapCount : 0),
    topBottomDelta: round(height >= 3 ? band(height - third, height) - band(0, third) : 0),
  };
}

export type Diagnosis =
  /** subject : le modèle d'IA ne voit pas de visage / de cheveux sur la photo */
  | { kind: "retake"; reason: "dark" | "blurry" | "overexposed" | "subject" }
  | { kind: "result"; score: number; healthy: boolean; issues: { key: IssueKey; level: Level }[]; terms: string[] };

/** Points d'attention (3 au plus, les modérés d'abord), indice de santé et termes des soins à chercher dans les salons */
function resultFor(mode: BeautyMode, issues: { key: IssueKey; level: Level }[], score?: number): Diagnosis {
  const top = [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "moderate" ? -1 : 1)).slice(0, 3);
  const computed = Math.max(40, 100 - top.reduce((s, i) => s + (i.level === "moderate" ? 14 : 7), 0));
  const terms = [...new Set((top.length ? top.map((i) => i.key) : [mode === "cheveux" ? "healthyHair" : "healthyFace"]).flatMap((k) => SERVICE_TERMS[k as keyof typeof SERVICE_TERMS]))];
  return { kind: "result", score: score ?? computed, healthy: top.length === 0, issues: top, terms };
}

/** Qualité de la photo jugée par le modèle : « ok » ou la raison de demander une autre photo */
export const VISION_QUALITY = ["ok", "dark", "blurry", "overexposed", "subject"] as const;

/** Réponse brute du modèle d'IA (vision), avant contrôle */
export type VisionReading = { quality: string; score: number; issues: { key: string; level: string }[] };

/** Contrôle local avant l'envoi au modèle : seulement les photos inexploitables à coup sûr (le modèle juge le reste) */
export function unusablePhoto(m: Metrics): Extract<Diagnosis, { kind: "retake" }> | null {
  if (m.brightness < 0.06) return { kind: "retake", reason: "dark" };
  if (m.brightness > 0.97) return { kind: "retake", reason: "overexposed" };
  if (m.sharpness < 0.003) return { kind: "retake", reason: "blurry" };
  return null;
}

/** Lecture du modèle validée : qualité de la photo, points d'attention connus pour ce mode, niveaux valides, indice borné (40–100) */
export function fromVision(mode: BeautyMode, reading: VisionReading): Diagnosis {
  if (reading.quality !== "ok") {
    const reason = (["dark", "blurry", "overexposed", "subject"] as const).find((q) => q === reading.quality) ?? "subject";
    return { kind: "retake", reason };
  }
  const allowed: readonly string[] = mode === "cheveux" ? HAIR_ISSUES : FACE_ISSUES;
  const issues: { key: IssueKey; level: Level }[] = [];
  for (const i of reading.issues ?? []) {
    if (allowed.includes(i.key) && (i.level === "moderate" || i.level === "light") && !issues.some((x) => x.key === i.key)) issues.push({ key: i.key as IssueKey, level: i.level });
  }
  const score = Number.isFinite(reading.score) ? Math.round(Math.min(100, Math.max(40, reading.score))) : undefined;
  return resultFor(mode, issues, issues.length === 0 ? Math.max(score ?? 100, 85) : score);
}

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
  return resultFor(mode, issues);
}
