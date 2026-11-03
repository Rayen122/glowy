import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { PhotoAnalysis, PointTransaction, Salon } from "@/infrastructure/db";
import { beautyAnalysis, diagnose, measure, type Metrics } from "@/modules/beauty";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

/** Image synthétique : haut sombre, bas clair (pointes éclaircies), avec un léger bruit de texture */
function gradientImage(w: number, h: number, top: number, bottom: number) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = Math.round(top + ((bottom - top) * y) / (h - 1) + ((x + y) % 2 ? 6 : -6));
      data.set([v, Math.round(v * 0.8), Math.round(v * 0.6), 255], (y * w + x) * 4);
    }
  }
  return data;
}

const base: Metrics = { brightness: 0.5, contrast: 0.1, saturation: 0.3, highlights: 0.02, redness: 0.05, sharpness: 0.05, topBottomDelta: 0 };

describe("IA P5 : analyse beauté par photo", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("mesures : luminosité, écart haut/bas et texture calculés sur les pixels", () => {
    const m = measure(gradientImage(30, 30, 60, 200), 30, 30);
    assert.ok(m.brightness > 0.35 && m.brightness < 0.6);
    assert.ok(m.topBottomDelta > 0.3, "bas plus clair que le haut");
    assert.ok(m.sharpness > 0.008, "texture présente");
  });

  test("rougeurs : aucune sur une peau normale, claire, mate ou foncée ; détectées sur une peau irritée", () => {
    const skin = ([r, g, b]: number[]) => {
      const data = new Uint8ClampedArray(40 * 40 * 4);
      for (let i = 0; i < 40 * 40; i += 1) {
        const n = (i + Math.floor(i / 40)) % 2 ? 8 : -8;
        data.set([r + n, g + n, b + n, 255], i * 4);
      }
      return measure(data, 40, 40).redness;
    };
    for (const normal of [[241, 194, 167], [198, 134, 103], [141, 85, 36], [92, 51, 23]]) assert.ok(skin(normal) < 0.12, `peau normale ${normal}`);
    assert.ok(skin([215, 115, 105]) > 0.2, "peau très rouge : rougeurs modérées");
    assert.ok(skin([220, 120, 100]) > 0.12, "coup de soleil");
  });

  test("diagnostic : règles explicables et repli quand la photo est inexploitable", () => {
    assert.deepEqual(diagnose("cheveux", { ...base, brightness: 0.1 }), { kind: "retake", reason: "dark" });
    assert.deepEqual(diagnose("visage", { ...base, sharpness: 0.002 }), { kind: "retake", reason: "blurry" });
    const hair = diagnose("cheveux", { ...base, topBottomDelta: 0.2, sharpness: 0.1, highlights: 0.002 });
    assert.equal(hair.kind, "result");
    if (hair.kind === "result") {
      assert.deepEqual(hair.issues.map((i) => i.key).sort(), ["dryEnds", "dullHair", "frizz"]);
      assert.equal(hair.score, 100 - 14 - 14 - 7);
      assert.ok(hair.terms.includes("kératine"));
    }
    const healthy = diagnose("visage", base);
    assert.equal(healthy.kind === "result" && healthy.healthy, true);
  });

  test("soins réels proposés ; cliente connectée : résultat enregistré, points une fois par mois", async () => {
    const { salon } = await makeSalon("salon-a");
    await Salon.updateOne({ _id: salon.id }, { $push: { services: { key: "keratine", name: "Soin kératine", group: "Soins", durationMin: 90, price: 150 } } });
    const client = await makeUser();
    const metrics = { ...base, highlights: 0.002, sharpness: 0.1 };
    const first = await beautyAnalysis(client.id, "cheveux", metrics);
    assert.equal(first.kind, "result");
    if (first.kind === "result") {
      assert.equal(first.services[0].service, "keratine");
      assert.equal(first.points, 10);
    }
    const second = await beautyAnalysis(client.id, "cheveux", metrics);
    assert.equal(second.kind === "result" && second.points, 0, "plafond : une analyse récompensée par mois");
    assert.equal(await PhotoAnalysis.countDocuments({ user: client.id }), 2);
    assert.equal(await PointTransaction.countDocuments({ user: client.id, reason: "PHOTO_ANALYSIS" }), 1);
    const guest = await beautyAnalysis(null, "cheveux", metrics);
    assert.equal(guest.kind === "result" && guest.saved, false);
  });
});
