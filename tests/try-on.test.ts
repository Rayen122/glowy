import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyShade, guidedFilter, HAIR_SHADES, headCrop, hexToLab, labToRgb, mergeCropMask, prepareHair, rgbToLab, type FaceBox } from "@/modules/beauty/domain/try-on";

/** Photo de 10 × 10 : moitié haute = cheveux châtain foncé avec quelques mèches, moitié basse = peau ; masque du modèle */
function photo() {
  const rgba = new Uint8ClampedArray(100 * 4);
  const mask = new Float32Array(100);
  for (let i = 0; i < 100; i++) {
    const hair = i < 50;
    const [r, g, b] = hair ? (i % 7 === 0 ? [92, 66, 50] : [48, 34, 27]) : [214, 170, 140];
    rgba.set([r, g, b, 255], i * 4);
    mask[i] = hair ? 0.97 : 0.02;
  }
  return { rgba, mask };
}
const meanLab = (rgba: Uint8ClampedArray, from: number, to: number) => {
  const labs = Array.from({ length: to - from }, (_, k) => rgbToLab(rgba[(from + k) * 4], rgba[(from + k) * 4 + 1], rgba[(from + k) * 4 + 2]));
  return { L: labs.reduce((s, x) => s + x.L, 0) / labs.length, a: labs.reduce((s, x) => s + x.a, 0) / labs.length, b: labs.reduce((s, x) => s + x.b, 0) / labs.length };
};

describe("Essai virtuel de couleur : recoloration des cheveux", () => {
  test("conversions sRGB ↔ CIELAB : aller-retour fidèle, blanc et noir aux bornes", () => {
    assert.ok(Math.abs(rgbToLab(255, 255, 255).L - 100) < 0.1);
    assert.ok(rgbToLab(0, 0, 0).L < 0.1);
    for (const shade of HAIR_SHADES) {
      const { L, a, b } = hexToLab(shade.hex);
      const back = labToRgb(L, a, b);
      const n = Number.parseInt(shade.hex.slice(1), 16);
      assert.deepEqual(back.map((c, i) => Math.abs(c - [(n >> 16) & 255, (n >> 8) & 255, n & 255][i]) <= 1), [true, true, true], shade.id);
    }
  });

  test("seuls les cheveux changent ; la couleur et la luminosité suivent la teinte, le relief des mèches reste", () => {
    const { rgba, mask } = photo();
    const prep = prepareHair(rgba, mask, 10, 10);
    assert.equal(prep.coverage, 0.5);
    assert.ok(prep.found);

    const copper = hexToLab(HAIR_SHADES.find((s) => s.id === "copper")!.hex);
    const out = applyShade(prep, rgba, copper, 1);
    assert.deepEqual(out.slice(50 * 4), rgba.slice(50 * 4), "la peau n'est pas touchée");
    const hair = meanLab(out, 0, 50);
    assert.ok(Math.abs(hair.L - copper.L) < 6, `luminosité proche de la teinte (${hair.L.toFixed(1)} / ${copper.L.toFixed(1)})`);
    assert.ok(hair.a > 20 && hair.b > 20, "reflet cuivré (rouge et jaune)");
    const strand = rgbToLab(out[0], out[1], out[2]).L; // pixel 0 : mèche plus claire à l'origine
    const base = rgbToLab(out[4], out[5], out[6]).L;
    assert.ok(strand > base + 5, "les mèches restent plus claires que le reste");

    const platinum = meanLab(applyShade(prep, rgba, hexToLab("#ddd5c8"), 1), 0, 50);
    assert.ok(platinum.L > 70, "éclaircissement possible depuis des cheveux foncés");

    // Blond miel : l'ombre d'une mèche reste dorée (angle de teinte sous 75°), pas kaki
    const honey = hexToLab("#c69358");
    const withShadow = Uint8ClampedArray.from(rgba);
    withShadow.set([16, 11, 9, 255], 3 * 4);
    const shaded = applyShade(prepareHair(withShadow, mask, 10, 10), withShadow, honey, 1);
    const dark = rgbToLab(shaded[12], shaded[13], shaded[14]);
    assert.ok(dark.L < honey.L, "pixel dans l'ombre");
    assert.ok((Math.atan2(dark.b, dark.a) * 180) / Math.PI < (Math.atan2(honey.b, honey.a) * 180) / Math.PI - 3, "ombre plus chaude que la teinte");
  });

  test("bord du masque sur fond clair : pas de halo blanc en passant au blond", () => {
    const { rgba, mask } = photo();
    // Pixel 49 : contour des cheveux mêlé au fond très clair, confiance moyenne du modèle
    rgba.set([236, 240, 246, 255], 49 * 4);
    mask[49] = 0.5;
    const honey = hexToLab("#c69358");
    const out = applyShade(prepareHair(rgba, mask, 10, 10), rgba, honey, 1);
    const edge = rgbToLab(out[49 * 4], out[49 * 4 + 1], out[49 * 4 + 2]);
    const background = rgbToLab(236, 240, 246);
    assert.ok(edge.L <= background.L + 0.5, `contour non éclairci au-delà du fond (${edge.L.toFixed(1)})`);
    assert.ok(Math.hypot(edge.a - background.a, edge.b - background.b) < 3, "pixel de fond laissé tel quel, sans liseré jaune");
  });

  test("intensité 0 = photo d'origine, intensité 0,5 = teinte intermédiaire appliquée en entier ; aucun cheveu détecté = rien à recolorer", () => {
    const { rgba, mask } = photo();
    const prep = prepareHair(rgba, mask, 10, 10);
    const plum = hexToLab("#5e2a55");
    assert.deepEqual(applyShade(prep, rgba, plum, 0), rgba);
    const [before, half, full] = [rgba, applyShade(prep, rgba, plum, 0.5), applyShade(prep, rgba, plum, 1)].map((img) => meanLab(img, 0, 50));
    // Ni l'origine ni la teinte pleine : entre les deux, en luminosité comme en couleur
    for (const key of ["L", "a", "b"] as const) {
      const [lo, hi] = [Math.min(before[key], full[key]), Math.max(before[key], full[key])];
      assert.ok(half[key] > lo - 0.5 && half[key] < hi + 0.5, `${key} : ${half[key]} hors de [${lo}, ${hi}]`);
    }
    assert.ok(Math.hypot(half.a - before.a, half.b - before.b) > 3, "à 50 %, le reflet se voit déjà");
    assert.deepEqual(meanLab(applyShade(prep, rgba, plum, 0.5), 50, 100), meanLab(rgba, 50, 100), "la peau ne change pas");

    const none = prepareHair(rgba, new Float32Array(100).fill(0.05), 10, 10);
    assert.equal(none.coverage, 0);
    assert.equal(none.found, false);
    assert.deepEqual(applyShade(none, rgba, plum, 1), rgba);
  });

  /**
   * Portrait synthétique de 80 × 80 : fond clair, visage couleur peau au centre, chevelure sombre striée (mèches)
   * au-dessus, et une tache de décor sombre et unie dans un coin que le modèle prend aussi pour des cheveux.
   */
  function portrait() {
    const W = 80;
    const rgba = new Uint8ClampedArray(W * W * 4);
    const mask = new Float32Array(W * W);
    const face: FaceBox = { x: 28, y: 30, width: 24, height: 28, eyes: [{ x: 35, y: 40 }, { x: 45, y: 40 }] };
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const inFace = Math.hypot((x - 40) / 12, (y - 44) / 14) < 1;
        const inHair = !inFace && Math.hypot((x - 40) / 20, (y - 34) / 20) < 1 && y < 46;
        const inBlob = x >= 70 && y < 10;
        let rgb = [228, 232, 238];
        if (inHair) rgb = x % 3 === 0 ? [70, 52, 40] : [36, 26, 20];
        else if (inFace) rgb = [212, 160, 128];
        else if (inBlob) rgb = [40, 30, 24];
        rgba.set([...rgb, 255], i * 4);
        mask[i] = inHair || inBlob ? 0.95 : inFace ? 0.6 : 0.02;
      }
    }
    return { W, rgba, mask, face };
  }

  test("le visage situe la tête : décor et visage écartés même quand le modèle les prend pour des cheveux", () => {
    const { W, rgba, mask, face } = portrait();
    const prep = prepareHair(rgba, mask, W, W, face);
    const alphaAt = (x: number, y: number) => {
      const k = prep.index.indexOf(y * W + x);
      return k < 0 ? 0 : prep.alpha[k];
    };
    assert.ok(alphaAt(40, 20) > 0.8, "cheveux au-dessus du visage");
    assert.ok(alphaAt(75, 5) < 0.05, "tache de décor dans le coin écartée");
    assert.ok(alphaAt(40, 48) < 0.05, "peau du visage écartée (confiance du modèle 0,6)");

    const out = applyShade(prep, rgba, hexToLab("#c69358"), 1);
    const near = (i: number, rgb: number[]) => rgb.every((c, k) => Math.abs(out[i * 4 + k] - c) <= 3);
    assert.ok(near(5 * W + 75, [40, 30, 24]), "décor inchangé");
    assert.deepEqual([...out.slice((48 * W + 40) * 4, (48 * W + 40) * 4 + 3)], [212, 160, 128], "visage inchangé");
  });

  test("sans visage détecté, la chevelure principale est gardée et les petits îlots écartés", () => {
    const { W, rgba, mask } = portrait();
    const prep = prepareHair(rgba, mask, W, W, null);
    const at = (x: number, y: number) => prep.alpha[prep.index.indexOf(y * W + x)] ?? 0;
    assert.ok(at(40, 20) > 0.8);
    assert.ok(prep.index.indexOf(5 * W + 75) < 0 || at(75, 5) < 0.05, "îlot du coin (≈ 1 % de la chevelure) écarté");
  });

  test("coupe rase sur un selfie large : cheveux trouvés par rapport au visage ; crâne rasé : rien", () => {
    // 200 × 200, visage de 40 × 50 au centre, calotte de cheveux de 6 px au-dessus : 0,6 % de la photo, 12 % du visage
    const W = 200;
    const rgba = new Uint8ClampedArray(W * W * 4);
    const mask = new Float32Array(W * W);
    const face: FaceBox = { x: 80, y: 80, width: 40, height: 50, eyes: [{ x: 92, y: 98 }, { x: 108, y: 98 }] };
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const head = x >= 80 && x < 120 && y >= 80 && y < 130;
        const cap = x >= 80 && x < 120 && y >= 74 && y < 80;
        rgba.set([...(cap ? [30, 24, 20] : head ? [196, 150, 120] : [150, 160, 170]), 255], i * 4);
        mask[i] = cap ? 0.97 : 0.02;
      }
    }
    const prep = prepareHair(rgba, mask, W, W, face);
    assert.ok(prep.coverage < 0.015, `couverture ${prep.coverage}`);
    assert.equal(prep.found, true);
    assert.equal(prepareHair(rgba, new Float32Array(W * W).fill(0.02), W, W, face).found, false, "sans cheveux");
  });

  test("cheveux longs le long du visage gardés (ils continuent sous le menton) ; une barbe reste protégée", () => {
    // 120 × 160 : visage de 40 × 50 ; mèche à gauche du visage, de la tête jusqu'à la poitrine ; barbe au menton
    const W = 120;
    const H = 160;
    const face: FaceBox = { x: 40, y: 30, width: 40, height: 50, eyes: [{ x: 52, y: 47 }, { x: 68, y: 47 }] };
    const rgba = new Uint8ClampedArray(W * H * 4);
    const mask = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const scalp = y >= 14 && y < 34 && x >= 36 && x < 84;
        const strand = x >= 42 && x < 49 && y >= 14 && y < 150;
        const beard = x >= 52 && x < 68 && y >= 68 && y < 86;
        const skin = x >= 40 && x < 80 && y >= 30 && y < 86;
        const hair = scalp || strand || beard;
        rgba.set([...(hair ? [40, 28, 22] : skin ? [205, 160, 130] : [150, 155, 160]), 255], i * 4);
        mask[i] = hair ? 0.95 : 0.03;
      }
    }
    const prep = prepareHair(rgba, mask, W, H, face);
    const alphaAt = (x: number, y: number) => {
      const k = prep.index.indexOf(y * W + x);
      return k < 0 ? 0 : prep.alpha[k];
    };
    assert.ok(alphaAt(45, 90) > 0.8, `mèche le long de la joue (${alphaAt(45, 90)})`);
    assert.ok(alphaAt(45, 120) > 0.8, "mèche sous le menton");
    assert.ok(alphaAt(60, 80) < 0.1, `barbe protégée (${alphaAt(60, 80)})`);
  });

  test("photo large : recadrage autour d'une petite tête pour une seconde segmentation, masque replacé avec fondu", () => {
    const small: FaceBox = { x: 500, y: 200, width: 60, height: 70, eyes: null };
    const crop = headCrop(small, 1024, 768)!;
    assert.deepEqual(crop, { x: 368, y: 88, width: 324, height: 427 });
    assert.equal(headCrop({ x: 300, y: 100, width: 300, height: 360, eyes: null }, 1024, 768), null, "visage déjà grand");

    const mask = new Float32Array(100 * 100).fill(0.1);
    const merged = mergeCropMask(mask, 100, { x: 20, y: 20, width: 40, height: 40 }, new Float32Array(40 * 40).fill(0.9));
    assert.ok(Math.abs(merged[40 * 100 + 40] - 0.9) < 1e-6, "centre du recadrage : nouveau masque");
    assert.equal(merged[5 * 100 + 5], mask[5 * 100 + 5], "hors recadrage : inchangé");
    assert.ok(merged[20 * 100 + 40] < 0.2, "bord du recadrage : fondu");
  });

  test("blond depuis des cheveux noirs : relief gardé (mèches plus claires, pas d'aplat)", () => {
    const { W, rgba, mask, face } = portrait();
    const prep = prepareHair(rgba, mask, W, W, face);
    const out = applyShade(prep, rgba, hexToLab("#c69358"), 1);
    const L = (x: number, y: number) => rgbToLab(out[(y * W + x) * 4], out[(y * W + x) * 4 + 1], out[(y * W + x) * 4 + 2]).L;
    assert.ok(L(39, 20) - L(40, 20) > 8, `mèche (x = 39) nettement plus claire que le fond des cheveux (${(L(39, 20) - L(40, 20)).toFixed(1)})`);
  });

  test("filtre guidé : le contour suit celui de la photo, valeurs bornées entre 0 et 1", () => {
    const W = 20;
    const guide = new Float32Array(W * W);
    const input = new Float32Array(W * W);
    for (let i = 0; i < W * W; i++) {
      const x = i % W;
      guide[i] = x < 10 ? 0.1 : 0.9;
      // Masque grossier, en escalier décalé de 2 px par rapport au vrai bord
      input[i] = x < 12 ? 1 : 0;
    }
    const out = guidedFilter(guide, input, W, W, 3, 0.001);
    assert.ok(out.every((v) => v >= 0 && v <= 1));
    assert.ok(out[5 * W + 4] > 0.9 && out[5 * W + 16] < 0.1);
    assert.ok(out[5 * W + 11] < 0.5, "le pixel clair (fond) sous le masque grossier est ramené vers 0");
  });
});
