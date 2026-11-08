/**
 * Essai virtuel de couleur — règles pures, testées.
 * Le masque des cheveux vient d'un modèle de segmentation exécuté sur l'appareil (MediaPipe, dans le navigateur) :
 * la photo ne quitte jamais le téléphone. Le masque est ensuite :
 *  - limité à la tête : un détecteur de visage (MediaPipe aussi) situe la tête ; un décor sombre ou flou pris pour
 *    des cheveux par le modèle est écarté, de même que le visage et la barbe ;
 *  - affiné sur les bords par un filtre guidé (la photo sert de guide) : le contour suit les mèches au lieu d'une
 *    découpe nette en forme de casque.
 * Recoloration dans l'espace CIELAB : la répartition des luminosités des cheveux (ombres, mèches, reflets) est
 * projetée sur une plage réaliste pour la teinte — un blond garde des ombres profondes et des reflets clairs,
 * au lieu d'un aplat — et la couleur (a*, b*) est celle de la teinte, atténuée dans les ombres et les reflets.
 */

export type ShadeFamily = "natural" | "warm" | "fashion";
export type HairShade = { id: string; hex: string; family: ShadeFamily };

/** Teintes proposées (couleur moyenne d'une chevelure colorée, pas celle du tube) */
export const HAIR_SHADES = [
  { id: "ebony", hex: "#1d1815", family: "natural" },
  { id: "chocolate", hex: "#4b2e22", family: "natural" },
  { id: "hazelnut", hex: "#7a5236", family: "natural" },
  { id: "ash", hex: "#a89b88", family: "natural" },
  { id: "caramel", hex: "#a46c3d", family: "warm" },
  { id: "honey", hex: "#c69358", family: "warm" },
  { id: "copper", hex: "#b0532b", family: "warm" },
  { id: "auburn", hex: "#7c2f1f", family: "warm" },
  { id: "platinum", hex: "#ddd5c8", family: "fashion" },
  { id: "rosegold", hex: "#c48a84", family: "fashion" },
  { id: "burgundy", hex: "#5c1a2b", family: "fashion" },
  { id: "plum", hex: "#5e2a55", family: "fashion" },
] as const satisfies readonly HairShade[];
export type ShadeId = (typeof HAIR_SHADES)[number]["id"];

export type Lab = { L: number; a: number; b: number };

/* Conversions sRGB ↔ CIELAB (illuminant D65) ; tables précalculées pour traiter une photo entière rapidement */
const TO_LINEAR = Float32Array.from({ length: 256 }, (_, c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
const GAMMA_STEPS = 4096;
const TO_SRGB = Uint8ClampedArray.from({ length: GAMMA_STEPS + 1 }, (_, i) => {
  const v = i / GAMMA_STEPS;
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
});
const WHITE = [0.95047, 1, 1.08883] as const;
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = (t: number) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);
const encode = (v: number) => TO_SRGB[Math.round(Math.min(1, Math.max(0, v)) * GAMMA_STEPS)];

export function rgbToLab(r: number, g: number, b: number): Lab {
  const [R, G, B] = [TO_LINEAR[r], TO_LINEAR[g], TO_LINEAR[b]];
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / WHITE[0]);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / WHITE[2]);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const X = WHITE[0] * fInv(fy + a / 500);
  const Y = fInv(fy);
  const Z = WHITE[2] * fInv(fy - b / 200);
  return [encode(3.2406 * X - 1.5372 * Y - 0.4986 * Z), encode(-0.9689 * X + 1.8758 * Y + 0.0415 * Z), encode(0.0557 * X - 0.204 * Y + 1.057 * Z)];
}

export function hexToLab(hex: string): Lab {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** En dessous de 1,5 % de la photo, le modèle n'a pas trouvé de cheveux (photo de dos, cheveux couverts, autre sujet) */
export const MIN_HAIR_COVERAGE = 0.015;
/**
 * Visage détecté : cheveux comptés par rapport au visage plutôt qu'à la photo. Une coupe rase (≈ 16 % de la surface du visage)
 * sur un selfie large n'occupe que 1 à 2 % de l'image ; en dessous de 6 % du visage, crâne rasé ou cheveux couverts.
 */
export const MIN_HAIR_PER_FACE = 0.06;

/** Visage détecté, en pixels de la photo traitée ; `eyes` : centre des deux yeux (null si inconnus) */
export type FaceBox = { x: number; y: number; width: number; height: number; eyes: { x: number; y: number }[] | null };

const eyeLine = (face: FaceBox) => (face.eyes?.length ? face.eyes.reduce((sum, e) => sum + e.y, 0) / face.eyes.length : face.y + face.height * 0.35);

export type HairPrep = {
  /** Pixels (index dans l'image) touchés par la recoloration, avec leur opacité et leur couleur d'origine en CIELAB */
  index: Uint32Array;
  alpha: Float32Array;
  L: Float32Array;
  A: Float32Array;
  B: Float32Array;
  /** Relief : écart de chaque pixel à la luminosité médiane des cheveux, en logarithme de la lumière (lissé) */
  D: Float32Array;
  /** Position dans la répartition des luminosités des cheveux (0 = médiane, ±0,5 ≈ 10e / 90e percentile), lissée */
  Z: Float32Array;
  /** Contraste des cheveux d'origine : écart entre 10e et 90e percentiles, en logarithme de la lumière */
  logRange: number;
  /** Luminosité des cheveux (pixels sûrs) : moyenne, écart type, et percentiles 10 / 50 / 90 */
  meanL: number;
  spreadL: number;
  p10: number;
  p50: number;
  p90: number;
  /** Part de la photo occupée par les cheveux, de 0 à 1 */
  coverage: number;
  /** Assez de cheveux pour l'essai : MIN_HAIR_COVERAGE de la photo, ou MIN_HAIR_PER_FACE du visage détecté */
  found: boolean;
};

const smoothstep = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

/** Moyenne sur une fenêtre carrée de rayon r (image intégrale : coût constant quel que soit r) */
function boxMean(src: Float32Array, width: number, height: number, r: number) {
  const W = width + 1;
  const sum = new Float64Array(W * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += src[y * width + x];
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
    }
  }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(height, y + r + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(width, x + r + 1);
      out[y * width + x] = (sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0]) / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/**
 * Filtre guidé (He, Sun et Tang, 2010) : lisse `input` (le masque) en suivant les contours de `guide` (la luminance
 * de la photo). Le bord du masque épouse alors les mèches et le fond, au lieu d'être une découpe en escalier.
 */
export function guidedFilter(guide: Float32Array, input: Float32Array, width: number, height: number, r: number, eps: number) {
  const n = guide.length;
  const II = new Float32Array(n);
  const Ip = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    II[i] = guide[i] * guide[i];
    Ip[i] = guide[i] * input[i];
  }
  const meanI = boxMean(guide, width, height, r);
  const meanP = boxMean(input, width, height, r);
  const corrI = boxMean(II, width, height, r);
  const corrIp = boxMean(Ip, width, height, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    a[i] = (corrIp[i] - meanI[i] * meanP[i]) / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxMean(a, width, height, r);
  const meanB = boxMean(b, width, height, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.min(1, Math.max(0, meanA[i] * guide[i] + meanB[i]));
  return out;
}

/**
 * Distance à la tête d'après le visage (0 au centre, 1 à la limite) : les cheveux peuvent monter d'environ
 * 1,3 hauteur de visage au-dessus, déborder de 1,9 largeur sur les côtés et descendre jusqu'aux épaules.
 */
function headDistance(face: FaceBox, px: number, py: number) {
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height * 0.35;
  const rx = face.width * 1.9;
  const ry = py < cy ? cy - (face.y - face.height * 1.3) : face.y + face.height * 3.2 - cy;
  return Math.hypot((px - cx) / rx, (py - cy) / ry);
}

/**
 * Centre du visage, sourcils, cils et barbe, d'après la géométrie : 1 sur ces zones, 0 ailleurs. Volontairement
 * étroit : les cheveux qui tombent le long des joues restent des cheveux ; la peau du front et des joues est écartée
 * par sa couleur (skinStats). Sourcils et cils suivent la position réelle des yeux (visage penché ou de trois quarts).
 * `hanging` (0 ou 1) : ce pixel appartient à des cheveux longs (hangingHair), la zone de barbe ne s'y applique pas.
 */
function faceSkin(face: FaceBox, px: number, py: number, hanging = 0) {
  const cx = face.x + face.width / 2;
  const eye = eyeLine(face);
  const brow = eye - face.height * 0.12;
  const top = smoothstep(brow - face.height * 0.06, brow + face.height * 0.04, py);
  const core = top * (1 - smoothstep(0.85, 1, Math.hypot((px - cx) / (face.width * 0.32), (py - (face.y + face.height * 0.6)) / (face.height * 0.5))));
  // Barbe : ellipse sous le nez, jusqu'au menton et un peu au-delà
  const beard = 1 - smoothstep(0.85, 1, Math.hypot((px - cx) / (face.width * 0.46), (py - (face.y + face.height * 1.0)) / (face.height * 0.42)));
  let eyes = 0;
  for (const e of face.eyes ?? []) {
    eyes = Math.max(eyes, 1 - smoothstep(0.8, 1, Math.hypot((px - e.x) / (face.width * 0.17), (py - (e.y - face.height * 0.06)) / (face.height * 0.15))));
  }
  return Math.max(core, beard * (1 - hanging) * smoothstep(eye + face.height * 0.25, eye + face.height * 0.35, py), eyes);
}

/**
 * Cheveux longs qui passent dans la zone de barbe : une barbe s'arrête au menton, des cheveux longs continuent dessous
 * (le long du cou, sur les épaules). On part des cheveux sûrs situés juste sous la zone de barbe et on remonte de proche
 * en proche dans les cheveux qui s'y relient (mèches collées aux joues comprises) : ces pixels ne sont pas une barbe.
 * Sans cela, les mèches qui tombent de part et d'autre du visage restaient de leur couleur d'origine.
 */
function hangingHair(mask: Float32Array, width: number, height: number, face: FaceBox) {
  const hanging = new Uint8Array(mask.length);
  const top = Math.round(face.y + face.height * 1.42);
  const bottom = Math.min(height, Math.round(top + face.height * 0.4));
  if (top >= height) return hanging;
  // Zone parcourue : sous les yeux, jusqu'au bas des germes, une largeur de visage de chaque côté
  const x0 = Math.max(0, Math.floor(face.x - face.width));
  const x1 = Math.min(width - 1, Math.ceil(face.x + face.width * 2));
  const y0 = Math.max(0, Math.floor(eyeLine(face)));
  const stack: number[] = [];
  for (let y = Math.max(0, top); y < bottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * width + x;
      if (mask[i] > 0.6) {
        hanging[i] = 1;
        stack.push(i);
      }
    }
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    for (const [qx, qy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (qx < x0 || qx > x1 || qy < y0 || qy >= bottom) continue;
      const q = qy * width + qx;
      if (hanging[q] || mask[q] <= 0.45) continue;
      hanging[q] = 1;
      stack.push(q);
    }
  }
  return hanging;
}

/** Couleur de la peau du visage, mesurée sur les joues et le nez (hors cheveux), ou null si trop peu de pixels */
function skinStats(rgba: Uint8ClampedArray, mask: Float32Array, width: number, height: number, face: FaceBox) {
  const cx = face.x + face.width / 2;
  const cy = eyeLine(face) + face.height * 0.22;
  const L: number[] = [];
  const A: number[] = [];
  const B: number[] = [];
  for (let y = Math.max(0, Math.round(cy - face.height * 0.15)); y < Math.min(height, cy + face.height * 0.15); y += 2) {
    for (let x = Math.max(0, Math.round(cx - face.width * 0.28)); x < Math.min(width, cx + face.width * 0.28); x += 2) {
      const i = y * width + x;
      if (mask[i] > 0.3) continue;
      const lab = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      L.push(lab.L);
      A.push(lab.a);
      B.push(lab.b);
    }
  }
  if (L.length < 30) return null;
  const [mL, sL] = robust(L, 5);
  const [mA, sA] = robust(A, 3);
  const [mB, sB] = robust(B, 3);
  // Photo en noir et blanc (ou éclairage très froid) : peau et cheveux clairs ne se distinguent plus par la couleur
  if (Math.hypot(mA, mB) < 7) return null;
  return { L: mL, a: mA, b: mB, sL, sA, sB };
}

/** Composantes connexes du masque sûr : sans visage détecté, on garde la chevelure principale (plus grande zone) */
function keepMainRegions(sure: Uint8Array, width: number) {
  const label = new Int32Array(sure.length).fill(-1);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < sure.length; start++) {
    if (!sure[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop()!;
      size += 1;
      const x = p % width;
      for (const q of [p - width, p + width, x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1]) {
        if (q >= 0 && q < sure.length && sure[q] && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  const largest = Math.max(0, ...sizes);
  return { label, keep: sizes.map((s) => s >= largest * 0.15) };
}

/** Médiane et dispersion robuste (écart absolu médian × 1,48), avec un plancher */
function robust(values: number[], floor: number): [number, number] {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const deviations = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return [median, Math.max(floor, deviations[deviations.length >> 1] * 1.48)];
}

function percentile(histogram: Float64Array, total: number, q: number) {
  let acc = 0;
  for (let i = 0; i < histogram.length; i++) {
    acc += histogram[i];
    if (acc >= total * q) return i / 4;
  }
  return (histogram.length - 1) / 4;
}

/**
 * Photo large (visage petit) : le modèle de segmentation travaille en 512 px, la tête n'y fait que quelques dizaines de
 * pixels et les cheveux sont à peine vus. On recadre autour de la tête (cheveux longs et épaules compris) pour une
 * seconde segmentation ; null si le visage est déjà grand dans la photo.
 */
export function headCrop(face: FaceBox, width: number, height: number) {
  if (face.height > height * 0.3) return null;
  const x = Math.max(0, Math.floor(face.x - face.width * 2.2));
  const y = Math.max(0, Math.floor(face.y - face.height * 1.6));
  const w = Math.min(width, Math.ceil(face.x + face.width * 3.2)) - x;
  const h = Math.min(height, Math.ceil(face.y + face.height * 4.5)) - y;
  return w * h > width * height * 0.9 || w < 32 || h < 32 ? null : { x, y, width: w, height: h };
}

/** Masque du recadrage (plus précis) replacé dans celui de la photo entière, fondu sur les bords du recadrage */
export function mergeCropMask(mask: Float32Array, width: number, crop: { x: number; y: number; width: number; height: number }, cropMask: Float32Array) {
  const out = Float32Array.from(mask);
  const feather = Math.max(4, Math.round(Math.min(crop.width, crop.height) * 0.04));
  for (let y = 0; y < crop.height; y++) {
    for (let x = 0; x < crop.width; x++) {
      const t = Math.min(1, Math.min(x, y, crop.width - 1 - x, crop.height - 1 - y) / feather);
      const i = (y + crop.y) * width + x + crop.x;
      out[i] = mask[i] * (1 - t) + cropMask[y * crop.width + x] * t;
    }
  }
  return out;
}

/**
 * Préparation, une fois par photo : `mask` = confiance « cheveux » de 0 à 1 par pixel (sortie du modèle),
 * `face` = visage détecté (null : pas de visage trouvé, on garde la chevelure principale).
 */
export function prepareHair(rgba: Uint8ClampedArray, mask: Float32Array, width: number, height: number, face: FaceBox | null = null): HairPrep {
  const pixels = mask.length;
  const prior = new Float32Array(pixels).fill(1);
  const distance = new Float32Array(pixels);
  if (face) {
    const hanging = hangingHair(mask, width, height, face);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        distance[i] = headDistance(face, x, y);
        prior[i] = (1 - smoothstep(0.8, 1.15, distance[i])) * (1 - faceSkin(face, x, y, hanging[i]));
      }
    }
  }

  // Contour : filtre guidé sur la luminance, rayon proportionnel à la photo (≈ 6 px pour 1 024 px)
  const guide = new Float32Array(pixels);
  const raw = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const p = i * 4;
    guide[i] = (0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) / 255;
    raw[i] = mask[i] * prior[i];
  }
  const radius = Math.max(1, Math.round(Math.max(width, height) / 170));
  const refined = guidedFilter(guide, raw, width, height, radius, 0.004);
  const smoothGuide = boxMean(guide, width, height, 1);

  const alphaAll = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) alphaAll[i] = smoothstep(0.18, 0.82, refined[i]) * prior[i];
  // Trous du modèle au milieu de la chevelure (ombres profondes, photo de webcam) : un pixel presque entièrement
  // entouré de cheveux est un cheveu. Le bord, lui, n'est pas assez entouré pour être touché.
  {
    const around = boxMean(alphaAll, width, height, radius * 2);
    for (let i = 0; i < pixels; i++) alphaAll[i] = Math.max(alphaAll[i], smoothstep(0.8, 0.95, around[i]) * prior[i]);
  }

  // Bords et mèches folles : un pixel du contour est un mélange de cheveu et de fond. Sa part de cheveu se lit sur sa
  // luminosité, entre celle des cheveux et celle du fond voisin (démélange). Sans cela, les fins bords des cheveux
  // gardent leur couleur d'origine et dessinent un liseré, l'effet « perruque ». Inutile si cheveux et fond se ressemblent.
  {
    const sure = Float32Array.from(alphaAll, (a) => (a > 0.8 ? 1 : 0));
    const free = Float32Array.from(alphaAll, (a) => (a < 0.05 ? 1 : 0));
    let hairLuma = 0;
    let count = 0;
    for (let i = 0; i < pixels; i += 3) {
      if (sure[i]) {
        hairLuma += guide[i];
        count += 1;
      }
    }
    hairLuma = count ? hairLuma / count : 0;
    const reach = radius * 3;
    const near = boxMean(sure, width, height, Math.max(1, Math.round(radius * 1.5)));
    const freeShare = boxMean(free, width, height, reach);
    const freeLuma = boxMean(Float32Array.from(guide, (g, i) => g * free[i]), width, height, reach);
    for (let i = 0; i < pixels; i++) {
      if (alphaAll[i] >= 0.95 || near[i] <= 0 || freeShare[i] < 0.05 || prior[i] <= 0) continue;
      const background = freeLuma[i] / freeShare[i];
      const contrast = background - hairLuma;
      if (Math.abs(contrast) < 0.12) continue;
      const share = Math.min(1, Math.max(0, (background - guide[i]) / contrast));
      alphaAll[i] = Math.max(alphaAll[i], share * smoothstep(0, 0.25, near[i]) * prior[i]);
    }
  }

  // Loin du visage, le modèle confond parfois un décor sombre ou flou avec des cheveux : il faut alors la couleur
  // des cheveux proches du visage ET de la texture (des mèches). Un fond flou n'a pas de texture.
  const texture = boxMean(
    guide.map((g, i) => Math.abs(g - smoothGuide[i])),
    width,
    height,
    3,
  );
  // Texture typique des cheveux sûrs : une zone où le modèle hésite (confiance moyenne) sans aucune texture est un
  // fond uni ou flou au ras de la chevelure, pas des cheveux — elle n'est pas recolorée (évite les halos)
  {
    const sureTexture: number[] = [];
    for (let i = 0; i < pixels; i += 3) if (alphaAll[i] > 0.9 && mask[i] > 0.9) sureTexture.push(texture[i]);
    if (sureTexture.length > 50) {
      const [typical] = robust(sureTexture, 0.002);
      for (let i = 0; i < pixels; i++) {
        if (alphaAll[i] <= 0.01) continue;
        const flat = 1 - smoothstep(0.15, 0.5, texture[i] / typical);
        alphaAll[i] *= 1 - 0.85 * flat * (1 - smoothstep(0.6, 0.95, mask[i]));
      }
    }
  }
  if (face) {
    const seedL: number[] = [];
    const seedA: number[] = [];
    const seedB: number[] = [];
    const seedT: number[] = [];
    for (let i = 0; i < pixels; i += 2) {
      if (alphaAll[i] < 0.85 || distance[i] > 0.55) continue;
      const lab = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
      seedL.push(lab.L);
      seedA.push(lab.a);
      seedB.push(lab.b);
      seedT.push(texture[i]);
    }
    if (seedL.length > 50) {
      const [mL, sL] = robust(seedL, 6);
      const [mA, sA] = robust(seedA, 4);
      const [mB, sB] = robust(seedB, 4);
      const [mT] = robust(seedT, 0.002);
      const skin = skinStats(rgba, mask, width, height, face);
      for (let i = 0; i < pixels; i++) {
        if (alphaAll[i] <= 0.01) continue;
        const far = smoothstep(0.5, 0.85, distance[i]);
        const lab = rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
        const gap = Math.hypot((lab.L - mL) / sL, (lab.a - mA) / sA, (lab.b - mB) / sB) / Math.sqrt(3);
        // Couleur de peau (front, tempes, cuir chevelu entre des cheveux courts) plus que de cheveux : pas recolorée
        if (skin) {
          const toSkin = Math.hypot((lab.L - skin.L) / skin.sL, (lab.a - skin.a) / skin.sA, (lab.b - skin.b) / skin.sB) / Math.sqrt(3);
          // Peau ou cheveu ? Comparaison aux deux couleurs de référence (peau des joues, cheveux près du visage).
          // Une peau franche (front, côtés rasés d'un dégradé, cuir chevelu) est écartée même si le modèle est sûr de lui ;
          // un reflet brun qui reste plus proche des cheveux que de la peau garde la couleur.
          // Là où le modèle hésite : un pixel plus proche de la peau que des cheveux est écarté. Partout : une peau franche
          // (très proche des joues, très loin des cheveux : front, côtés rasés d'un dégradé) est écartée même si le modèle
          // est sûr de lui. Les pixels mixtes de la lisière (mi-cheveu, mi-peau) restent : sinon un liseré sombre apparaît.
          const doubtful = (1 - smoothstep(1.2, 2.4, toSkin)) * smoothstep(0, 0.5, (gap - toSkin) / Math.max(gap, 0.001)) * (1 - smoothstep(0.82, 0.97, mask[i]));
          const clearSkin = (1 - smoothstep(1, 1.8, toSkin)) * smoothstep(2.6, 3.6, gap);
          alphaAll[i] *= 1 - Math.max(doubtful, clearSkin);
        }
        if (far === 0) continue;
        // Netteté : les cheveux sont au point, le décor derrière est flou (texture fine bien plus faible)
        const evidence = (1 - smoothstep(1.6, 3.2, gap)) * (0.05 + 0.95 * smoothstep(0.35, 0.75, texture[i] / Math.max(mT, 0.002)));
        alphaAll[i] *= 1 - far * (1 - evidence);
      }
    }
  }

  // Lisière du front : de vrais cheveux s'y raréfient sur quelques millimètres ; une limite nette entre la couleur et
  // la peau fait « casque ». Fondu progressif côté visage seulement (au-dessus des sourcils, dans la largeur du visage).
  if (face) {
    const edge = boxMean(alphaAll, width, height, Math.max(1, Math.round(radius * 1.5)));
    const cx = face.x + face.width / 2;
    const brow = eyeLine(face) - face.height * 0.12;
    for (let y = Math.max(0, Math.floor(face.y - face.height * 0.4)); y < Math.min(height, Math.ceil(brow)); y++) {
      // Nul en haut de la tête et à hauteur des sourcils (tempes, pattes) : aucune limite nette du fondu
      const vertical = smoothstep(face.y - face.height * 0.4, face.y - face.height * 0.15, y) * (1 - smoothstep(brow - face.height * 0.14, brow - face.height * 0.02, y));
      for (let x = Math.max(0, Math.floor(face.x - face.width * 0.1)); x < Math.min(width, Math.ceil(face.x + face.width * 1.1)); x++) {
        const i = y * width + x;
        if (alphaAll[i] <= 0.01) continue;
        const across = 1 - smoothstep(face.width * 0.45, face.width * 0.6, Math.abs(x - cx));
        const fade = smoothstep(0.3, 0.85, edge[i]);
        alphaAll[i] *= 1 - vertical * across * (1 - fade);
      }
    }
  }

  // Sans visage : îlots détachés de la chevelure principale (décor sombre) écartés
  if (!face) {
    const sure = new Uint8Array(pixels);
    for (let i = 0; i < pixels; i++) sure[i] = alphaAll[i] > 0.5 ? 1 : 0;
    const { label, keep } = keepMainRegions(sure, width);
    // Les pixels de bord (non sûrs) suivent la zone sûre la plus proche dans un voisinage ; à défaut, on les garde
    const near = boxMean(Float32Array.from(sure, (s, i) => (s && keep[label[i]] ? 1 : 0)), width, height, radius * 2);
    for (let i = 0; i < pixels; i++) {
      if (sure[i] && !keep[label[i]]) alphaAll[i] = 0;
      else if (!sure[i]) alphaAll[i] *= Math.min(1, near[i] * 4);
    }
  }

  const keepIdx: number[] = [];
  let sure = 0;
  for (let i = 0; i < pixels; i++) {
    if (alphaAll[i] <= 0.01) continue;
    keepIdx.push(i);
    if (alphaAll[i] > 0.5) sure += 1;
  }
  const index = Uint32Array.from(keepIdx);
  const alpha = new Float32Array(index.length);
  const L = new Float32Array(index.length);
  const A = new Float32Array(index.length);
  const B = new Float32Array(index.length);
  const histogram = new Float64Array(401);
  // Relief mesuré sur le logarithme de la luminance : dans des cheveux très foncés, mèches et reflets ne diffèrent
  // que de quelques unités de L* mais d'un facteur 2 à 4 en lumière ; c'est ce rapport qu'on veut garder
  const G = new Float32Array(index.length);
  const logHistogram = new Float64Array(401);
  let sumL = 0;
  let sumL2 = 0;
  let weight = 0;
  for (let k = 0; k < index.length; k++) {
    const p = index[k] * 4;
    const lab = rgbToLab(rgba[p], rgba[p + 1], rgba[p + 2]);
    alpha[k] = alphaAll[index[k]];
    L[k] = lab.L;
    A[k] = lab.a;
    B[k] = lab.b;
    G[k] = Math.log(fInv((lab.L + 16) / 116) + 0.004);
    if (alpha[k] > 0.6) {
      sumL += lab.L * alpha[k];
      sumL2 += lab.L * lab.L * alpha[k];
      weight += alpha[k];
      histogram[Math.round(Math.min(100, Math.max(0, lab.L)) * 4)] += alpha[k];
      logHistogram[Math.round(Math.min(100, Math.max(0, (G[k] + 6) * 16)) * 4)] += alpha[k];
    }
  }
  // Position dans la répartition : 0 à la médiane, ±0,5 vers les 10e et 90e percentiles (plancher : cheveux unis)
  const g10 = weight > 0 ? percentile(logHistogram, weight, 0.1) / 16 - 6 : 0;
  const g50 = weight > 0 ? percentile(logHistogram, weight, 0.5) / 16 - 6 : 0;
  const g90 = weight > 0 ? percentile(logHistogram, weight, 0.9) / 16 - 6 : 0;
  // Relief en lumière : écart au médian, en logarithme (une ombre deux fois plus sombre = −0,69), lissé sur 5 × 5 pixels
  // environ pour que le grain du capteur ou de la compression ne devienne pas des taches de couleur
  // Position dans la répartition (rang et logarithme), pour les teintes claires : étale les tons moyens sans taches
  const cdf = new Float64Array(logHistogram.length);
  let running = 0;
  for (let i = 0; i < logHistogram.length; i++) {
    // Rang moyen des ex æquo (milieu de la case) : une chevelure unie reste centrée sur la teinte
    cdf[i] = weight > 0 ? (running + logHistogram[i] / 2) / weight : 0.5;
    running += logHistogram[i];
  }
  const logWidth = Math.max(g90 - g10, 0.45);
  // Cheveux presque unis : leurs écarts sont surtout du bruit, le rang les amplifierait en grain
  const rankWeight = 0.6 * smoothstep(0.3, 0.9, g90 - g10);

  // Cheveux très sombres (photo de webcam, faible lumière) : les écarts mesurés y sont surtout du bruit et des blocs
  // de compression JPEG, lissés plus largement (≈ 7 × 7), avec moins de valeur brute
  const full = new Float32Array(pixels);
  for (let k = 0; k < index.length; k++) full[index[k]] = G[k] - g50;
  // Rayons proportionnels à la photo (1 et 2 px pour 1 024 px ; rien sur une vignette, sans bruit de capteur à lisser)
  const step = Math.round(Math.max(width, height) / 512);
  const dark = 1 - smoothstep(0.012, 0.05, Math.exp(g50));
  const fine = step > 0 ? boxMean(boxMean(full, width, height, 1), width, height, 1) : full;
  const wide = step > 0 && dark > 0 ? boxMean(boxMean(full, width, height, step), width, height, 1) : fine;
  const D = G.map((g, k) => {
    const smooth = fine[index[k]] * (1 - dark) + wide[index[k]] * dark;
    const rawShare = 0.35 - 0.2 * dark;
    return rawShare * (g - g50) + (1 - rawShare) * smooth;
  });
  const zFull = new Float32Array(pixels);
  for (let k = 0; k < index.length; k++) {
    const rank = cdf[Math.round(Math.min(100, Math.max(0, (G[k] + 6) * 16)) * 4)] - 0.5;
    zFull[index[k]] = rankWeight * rank + (1 - rankWeight) * ((G[k] - g50) / logWidth);
  }
  const zSmooth = step > 0 ? boxMean(boxMean(zFull, width, height, 1), width, height, 1) : zFull;
  const Z = G.map((_, k) => 0.35 * zFull[index[k]] + 0.65 * zSmooth[index[k]]);
  const meanL = weight > 0 ? sumL / weight : 0;
  const spreadL = weight > 0 ? Math.sqrt(Math.max(0, sumL2 / weight - meanL * meanL)) : 0;
  const p10 = weight > 0 ? percentile(histogram, weight, 0.1) : meanL;
  const p50 = weight > 0 ? percentile(histogram, weight, 0.5) : meanL;
  const p90 = weight > 0 ? percentile(histogram, weight, 0.9) : meanL;

  // Un pixel bien plus clair que les cheveux est du fond pris dans le contour (ciel, mur, peau) ou un reflet de lumière
  // (blanc quelle que soit la couleur) : il garde sa couleur d'origine. Le bord du masque est plus strict.
  const spread = Math.max(spreadL, 4);
  for (let k = 0; k < index.length; k++) {
    const deviation = Math.abs(L[k] - meanL) / spread - (alpha[k] >= 0.97 ? 2.5 : 2);
    if (deviation > 0) alpha[k] *= Math.max(0, 1 - deviation / 2);
  }
  const coverage = pixels > 0 ? sure / pixels : 0;
  const found = coverage >= MIN_HAIR_COVERAGE || (face !== null && sure >= MIN_HAIR_PER_FACE * face.width * face.height);
  return { index, alpha, L, A, B, D, Z, logRange: Math.max(g90 - g10, 0.3), meanL, spreadL, p10, p50, p90, coverage, found };
}

/**
 * Photo recolorée (copie de `original`, RGBA) : `intensity` de 0 (photo d'origine) à 1 (teinte choisie pleine) ;
 * entre les deux, une teinte intermédiaire entre la couleur actuelle et la teinte choisie, appliquée en entier.
 * Luminosité, selon la teinte :
 *  - teintes foncées (brun, chocolat, auburn, bourgogne) : comme une vraie coloration, la lumière moyenne devient celle
 *    de la teinte et chaque pixel garde son RAPPORT de lumière à cette moyenne — une ombre deux fois plus sombre le
 *    reste, le relief n'est pas aplati (contraste d'une chevelure foncée, ≈ ×4,5 entre ombres et reflets) ;
 *  - teintes claires (blond, platine, caramel) : la position de chaque pixel dans la répartition des cheveux (ombre,
 *    ton moyen, mèche, reflet) est reportée sur une plage centrée sur la teinte ; des cheveux noirs passés en blond
 *    gardent des mèches visibles, sans taches là où les reflets d'origine étaient très marqués.
 * Passage progressif entre les deux. Écarts bornés en douceur (un fond clair mêlé au contour ne devient pas un halo).
 * Couleur : celle de la teinte, pleine dans les tons moyens, atténuée dans les ombres profondes (un cheveu sombre ne
 * montre qu'un reflet) et dans les reflets de lumière ; l'ombre d'un blond reste dorée, pas kaki. Un léger reste de la
 * couleur d'origine garde un rendu naturel.
 */
const WARM_HUE = (50 * Math.PI) / 180;

export function applyShade(prep: HairPrep, original: Uint8ClampedArray, chosen: Lab, intensity: number): Uint8ClampedArray<ArrayBuffer> {
  const out = Uint8ClampedArray.from(original);
  const strength = Math.min(1, Math.max(0, intensity));
  if (strength === 0 || prep.index.length === 0) return out;
  // Intensité = force de la coloration, comme au salon : la teinte obtenue va de la couleur actuelle des cheveux
  // (moyenne pondérée par le masque) à la teinte choisie, et elle est appliquée en entier sur les cheveux — une
  // coloration légère donne un reflet, pas un voile transparent qui laisse voir l'ancienne couleur. Sous 20 %,
  // passage en douceur depuis la photo d'origine.
  let weight = 0;
  let sumA = 0;
  let sumB = 0;
  for (let k = 0; k < prep.index.length; k++) {
    weight += prep.alpha[k];
    sumA += prep.alpha[k] * prep.A[k];
    sumB += prep.alpha[k] * prep.B[k];
  }
  const from = { L: prep.meanL, a: weight > 0 ? sumA / weight : 0, b: weight > 0 ? sumB / weight : 0 };
  const shade = { L: from.L + (chosen.L - from.L) * strength, a: from.a + (chosen.a - from.a) * strength, b: from.b + (chosen.b - from.b) * strength };
  const fade = smoothstep(0, 0.2, strength);
  const chroma = Math.hypot(shade.a, shade.b);
  const hue = Math.atan2(shade.b, shade.a);
  const light = smoothstep(35, 55, shade.L);
  // Teintes foncées : contraste en rapports de lumière
  const shadeY = fInv((shade.L + 16) / 116);
  const gain = Math.min(0.85, Math.max(0.3, Math.log(2.2 + 2.6 * (1 - Math.min(1, shade.L / 90))) / prep.logRange));
  // Teintes claires : plage cible du 10e au 90e percentile, ≈ 30 à 40 unités de L* ; jamais moins que celle d'origine
  const sourceWidth = Math.max(prep.p90 - prep.p10, 8);
  const targetWidth = Math.max(Math.min(40, 0.5 * shade.L + 8), Math.min(sourceWidth, 30));
  for (let k = 0; k < prep.index.length; k++) {
    const edge = 0.6 + 0.4 * prep.alpha[k];
    let d = gain * prep.D[k];
    d = (d < 0 ? -1.8 * Math.tanh(-d / 1.8) : 0.55 * Math.tanh(d / 0.55)) * edge;
    const z = 1.1 * Math.tanh((prep.Z[k] * 1.25) / 1.1) * edge;
    const fromRatio = 116 * f(Math.min(1, shadeY * Math.exp(d))) - 16;
    const fromSpread = shade.L + z * targetWidth;
    const L = Math.min(98, Math.max(1, fromRatio * (1 - light) + fromSpread * light));
    // Couleur pleine dans les tons moyens, moins saturée dans les ombres profondes et dans les reflets
    const tintDark = Math.min(1.1, Math.max(0.15, (L / Math.max(shade.L, 1)) ** 1.3)) * (1 - 0.25 * smoothstep(0.25, 0.55, d));
    const tintLight = Math.min(1.15, Math.max(0.45, L / Math.max(shade.L, 1))) * (1 - 0.35 * smoothstep(0.55, 1.1, z));
    const tint = tintDark * (1 - light) + tintLight * light;
    // Dans l'ombre, une teinte jaune (angle > 50°) glisse vers l'orangé
    const shadow = Math.min(1, Math.max(0, (shade.L - L) / Math.max(shade.L, 1)));
    const angle = hue > WARM_HUE ? hue - (hue - WARM_HUE) * shadow * 0.8 : hue;
    const [r, g, b] = labToRgb(L, Math.cos(angle) * chroma * tint * 0.9 + prep.A[k] * 0.1, Math.sin(angle) * chroma * tint * 0.9 + prep.B[k] * 0.1);
    const mix = prep.alpha[k] * fade;
    const p = prep.index[k] * 4;
    out[p] = original[p] + (r - original[p]) * mix;
    out[p + 1] = original[p + 1] + (g - original[p + 1]) * mix;
    out[p + 2] = original[p + 2] + (b - original[p + 2]) * mix;
  }
  return out;
}

/**
 * Zone où le rendu photoréaliste peut être recollé, calculée une fois par photo :
 * `matte` = les cheveux de l'aperçu (`prep`) et tout ce que le modèle de segmentation voit comme cheveux, hors visage ;
 * `near` = les abords des cheveux (mèches à moitié détectées, enroulées sur une brosse…), hors visage, où un pixel
 * nettement recoloré par le modèle d'image sera repris (voir renderAlpha).
 */
export type RenderZone = { matte: Float32Array; near: Uint8Array };

export function renderZone(prep: HairPrep, mask: Float32Array, width: number, height: number, face: FaceBox | null = null): RenderZone {
  const pixels = width * height;
  const matte = new Float32Array(pixels);
  const skin = new Float32Array(pixels);
  const seed = new Uint8Array(pixels);
  const hanging = face ? hangingHair(mask, width, height, face) : null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      skin[i] = face ? faceSkin(face, x, y, hanging![i]) : 0;
      matte[i] = smoothstep(0.25, 0.6, mask[i]) * (1 - skin[i]);
      seed[i] = mask[i] > 0.08 ? 1 : 0;
    }
  }
  for (let k = 0; k < prep.index.length; k++) matte[prep.index[k]] = Math.max(matte[prep.index[k]], prep.alpha[k]);
  // Abords : dilatation carrée du germe (rayon ≈ 2,5 % du grand côté), lignes puis colonnes par sommes glissantes
  const r = Math.max(1, Math.round(Math.max(width, height) / 40));
  const rows = new Uint8Array(pixels);
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < Math.min(r, width); x++) count += seed[y * width + x];
    for (let x = 0; x < width; x++) {
      if (x + r < width) count += seed[y * width + x + r];
      if (x - r - 1 >= 0) count -= seed[y * width + x - r - 1];
      rows[y * width + x] = count > 0 ? 1 : 0;
    }
  }
  const near = new Uint8Array(pixels);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < Math.min(r, height); y++) count += rows[y * width + x];
    for (let y = 0; y < height; y++) {
      if (y + r < height) count += rows[(y + r) * width + x];
      if (y - r - 1 >= 0) count -= rows[(y - r - 1) * width + x];
      near[y * width + x] = count > 0 && skin[y * width + x] < 0.5 ? 1 : 0;
    }
  }
  return { matte, near };
}

/**
 * Opacité du rendu, une fois par rendu : la zone des cheveux, plus, aux abords, les pixels dont le modèle d'image a
 * nettement changé la couleur (écart ΔE de 12 à 28 dans CIELAB). Le reste du rendu (décor régénéré, retouches
 * légères) est ignoré : la photo d'origine reste.
 */
export function renderAlpha(zone: RenderZone, original: Uint8ClampedArray, render: Uint8ClampedArray) {
  const alpha = Float32Array.from(zone.matte);
  for (let i = 0; i < alpha.length; i++) {
    if (!zone.near[i] || alpha[i] >= 1) continue;
    const p = i * 4;
    const a = rgbToLab(original[p], original[p + 1], original[p + 2]);
    const b = rgbToLab(render[p], render[p + 1], render[p + 2]);
    alpha[i] = Math.max(alpha[i], smoothstep(12, 28, Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b)));
  }
  return alpha;
}

/**
 * Rendu photoréaliste (modèle d'image) recollé sur la photo d'origine selon `alpha` (renderAlpha), dosé par `strength` ;
 * visage et décor restent ceux de la photo, même si le modèle les a modifiés
 */
export function blendRender(alpha: Float32Array, original: Uint8ClampedArray, render: Uint8ClampedArray, strength: number): Uint8ClampedArray<ArrayBuffer> {
  const out = Uint8ClampedArray.from(original);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i] * strength;
    if (a <= 0) continue;
    const p = i * 4;
    for (let c = 0; c < 3; c++) out[p + c] = original[p + c] + a * (render[p + c] - original[p + c]);
  }
  return out;
}
