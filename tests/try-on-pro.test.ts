import "./setup";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { hit } from "@/infrastructure/rate-limit";
import { closestAspectRatio, fluxSize, proColorPrompt, proHairColor, tryOnProInput } from "@/modules/beauty";
import { blendRender, HAIR_SHADES, prepareHair, renderAlpha, renderZone } from "@/modules/beauty/domain/try-on";
import { closeDb } from "./helpers";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/";

describe("Essai couleur : rendu photoréaliste (FLUX.2 gratuit, Gemini en secours)", () => {
  after(closeDb);

  test("consigne : seule la couleur des cheveux change, teinte en mots de coloriste (sans code couleur, rendu trop saturé)", () => {
    const prompts = HAIR_SHADES.map((shade) => proColorPrompt(shade.id));
    for (const prompt of prompts) {
      assert.match(prompt, /^Change only the hair color of the person to /);
      assert.match(prompt, /Do not change the face/);
      assert.doesNotMatch(prompt, /#[0-9a-f]{6}/i);
    }
    assert.equal(new Set(prompts).size, HAIR_SHADES.length, "une consigne par teinte");
    assert.match(proColorPrompt("auburn"), /reddish-brown/);
    assert.match(proColorPrompt("ash"), /ash blonde/);
  });

  test("format du rendu : le plus proche de la photo, pour garder le cadrage", () => {
    assert.equal(closestAspectRatio(683, 1024), "2:3");
    assert.equal(closestAspectRatio(1280, 720), "16:9");
    assert.equal(closestAspectRatio(1024, 768), "4:3");
    assert.equal(closestAspectRatio(768, 1024), "3:4");
    assert.equal(closestAspectRatio(900, 910), "1:1");
    assert.equal(closestAspectRatio(819, 1024), "4:5");
  });

  test("FLUX.2 (Cloudflare) : rendu au cadrage de la photo, 1024 px au plus, côtés multiples de 16", () => {
    assert.deepEqual(fluxSize(683, 1024), { width: 688, height: 1024 });
    assert.deepEqual(fluxSize(1024, 768), { width: 1024, height: 768 });
    assert.deepEqual(fluxSize(400, 600), { width: 688, height: 1024 });
    assert.deepEqual(fluxSize(1024, 300), { width: 1024, height: 304 });
  });

  test("rendu recollé : seuls les cheveux prennent les pixels du rendu, le visage reste celui de la photo", () => {
    // 10 × 10 : moitié haute = cheveux (masque 0,97), moitié basse = visage ; le « rendu » a tout repeint en rouge
    const original = new Uint8ClampedArray(400);
    const mask = new Float32Array(100);
    for (let i = 0; i < 100; i++) {
      original.set(i < 50 ? [48, 34, 27, 255] : [214, 170, 140, 255], i * 4);
      mask[i] = i < 50 ? 0.97 : 0.02;
    }
    const render = new Uint8ClampedArray(400);
    for (let i = 0; i < 100; i++) render.set([150, 30, 20, 255], i * 4);
    const zone = renderZone(prepareHair(original, mask, 10, 10), mask, 10, 10);
    const alpha = renderAlpha(zone, original, render);
    const full = blendRender(alpha, original, render, 1);
    assert.deepEqual([...full.slice(77 * 4, 77 * 4 + 4)], [214, 170, 140, 255], "visage intact");
    assert.ok(Math.abs(full[22 * 4] - 150) <= 6, `cheveux du rendu (${full[22 * 4]})`);
    const half = blendRender(alpha, original, render, 0.5);
    assert.ok(half[22 * 4] > 80 && half[22 * 4] < 120, `intensité 50 % (${half[22 * 4]})`);
    assert.deepEqual(blendRender(alpha, original, render, 0), original);

    // Mèche isolée que l'aperçu écarte (îlot) mais que le modèle de segmentation voit : recollée quand même
    const loose = Float32Array.from(mask);
    loose[95] = 0.9;
    assert.ok(renderZone(prepareHair(original, mask, 10, 10), loose, 10, 10).matte[95] > 0.9);
  });

  test("abords des cheveux : un pixel nettement recoloré est repris, un décor à peine retouché ne l'est pas, loin des cheveux rien", () => {
    // 40 × 40 : cheveux en haut (lignes 0 à 9), mèche à moitié détectée ligne 12, décor gris dessous
    const W = 40;
    const original = new Uint8ClampedArray(W * W * 4);
    const mask = new Float32Array(W * W);
    const render = new Uint8ClampedArray(W * W * 4);
    for (let i = 0; i < W * W; i++) {
      const y = Math.floor(i / W);
      const hair = y < 10 || y === 12;
      original.set(hair ? [230, 210, 160, 255] : [200, 200, 200, 255], i * 4);
      mask[i] = y < 10 ? 0.97 : y === 12 ? 0.15 : 0.01;
      // Rendu : cheveux et mèche en auburn, décor très légèrement retouché
      render.set(hair ? [110, 40, 30, 255] : [204, 198, 201, 255], i * 4);
    }
    const alpha = renderAlpha(renderZone(prepareHair(original, mask, W, W), mask, W, W), original, render);
    assert.ok(alpha[12 * W + 20] > 0.95, `mèche à moitié détectée reprise (${alpha[12 * W + 20]})`);
    assert.ok(alpha[13 * W + 20] < 0.05, "décor retouché à peine : photo d'origine");
    assert.equal(alpha[39 * W + 20], 0, "loin des cheveux : rien");
  });

  test("entrée validée : teinte connue, vraie image, dimensions plausibles", () => {
    assert.equal(tryOnProInput.safeParse({ shade: "auburn", image: JPEG, small: JPEG, width: 683, height: 1024 }).success, true);
    assert.equal(tryOnProInput.safeParse({ shade: "vert-fluo", image: JPEG, small: JPEG, width: 683, height: 1024 }).success, false, "teinte inconnue");
    assert.equal(tryOnProInput.safeParse({ shade: "auburn", image: "https://exemple.tn/photo.jpg", width: 683, height: 1024 }).success, false, "pas d'adresse distante");
    assert.equal(tryOnProInput.safeParse({ shade: "auburn", image: "data:text/html;base64,PHNjcmlwdD4=", width: 683, height: 1024 }).success, false, "pas d'autre type");
    assert.equal(tryOnProInput.safeParse({ shade: "auburn", image: JPEG, small: JPEG, width: 10, height: 99_999 }).success, false, "dimensions");
    assert.equal(tryOnProInput.safeParse({ shade: "auburn", image: JPEG, width: 683, height: 1024 }).success, false, "petite image manquante");
  });

  test("sans modèle d'image (aucune clé, tests) : 503, l'aperçu instantané reste la solution", async () => {
    await assert.rejects(proHairColor({ shade: "auburn", image: JPEG, small: JPEG, width: 683, height: 1024 }), (e: AppError) => e instanceof AppError && e.status === 503 && e.code === "TRY_ON_UNAVAILABLE");
  });

  test("coût maîtrisé : 6 rendus par 10 minutes et par personne, 300 par jour pour la plateforme", () => {
    const now = Date.parse("2031-03-03T10:00:00Z");
    for (let i = 0; i < 6; i++) assert.equal(hit("tryOn", "cliente-a", now + i * 1000), true);
    assert.equal(hit("tryOn", "cliente-a", now + 10_000), false, "7e rendu en 10 minutes");
    assert.equal(hit("tryOn", "cliente-b", now + 10_000), true, "compteur par personne");
    assert.equal(hit("tryOn", "cliente-a", now + 11 * 60_000), true, "fenêtre de 10 minutes écoulée");
    for (let i = 0; i < 300; i++) assert.equal(hit("tryOnBudget", "all", now + i), true);
    assert.equal(hit("tryOnBudget", "all", now + 400), false, "budget du jour atteint");
    assert.equal(hit("tryOnBudget", "all", now + 25 * 3_600_000), true, "nouveau jour");
  });
});
