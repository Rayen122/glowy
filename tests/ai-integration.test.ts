import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { fromVision } from "@/modules/beauty/domain/analysis";
import { applyAiRanking } from "@/modules/catalog/domain/recommend";
import { analyzeReview, mergeAiAnalysis, objectiveSuspicion, SUSPICION_ALERT } from "@/modules/reviews/domain/analysis";

describe("IA par API : les réponses des modèles sont contrôlées avant d'être utilisées", () => {
  test("P4 : lecture du modèle retenue (ironie comprise), aspects inconnus écartés, suspicion la plus haute des deux", () => {
    const local = analyzeReview({ text: "Super, encore 45 minutes de retard… merci pour rien. www.promo.com", rating: 1 });
    const merged = mergeAiAnalysis(local, {
      sentiment: "negatif",
      score: -3,
      aspects: [{ aspect: "attente", polarity: -1 }, { aspect: "parking", polarity: 1 }, { aspect: "attente", polarity: 1 }, { aspect: "prix", polarity: 0 }],
      suspicion: 20,
      suspicionReason: "Lien publicitaire",
    });
    assert.equal(merged.sentiment, "negatif");
    assert.equal(merged.score, -1, "score borné");
    assert.deepEqual(merged.aspects, [{ aspect: "attente", polarity: -1 }]);
    assert.equal(merged.suspicion, Math.max(local.suspicion, 20), "le lien reste un indice objectif");
    assert.equal(merged.source, "ai");
    assert.equal(mergeAiAnalysis(local, { sentiment: "??", score: Number.NaN, aspects: [], suspicion: Number.NaN }).sentiment, local.sentiment, "réponse invalide : règles locales");
  });

  test("P4 : la note contredite est jugée par le modèle quand il a lu l'avis ; les indices objectifs restent (IA-08)", () => {
    const genuine = { text: "Coiffeuse aimable mais le résultat ne correspond pas du tout à ce que j'avais demandé.", rating: 2 };
    const local = analyzeReview(genuine);
    assert.ok(local.suspicion >= SUSPICION_ALERT, "le lexique rate la négation et croit à une note contredite");
    const read = mergeAiAnalysis(local, { sentiment: "negatif", score: -0.6, aspects: [], suspicion: 5 }, objectiveSuspicion(genuine));
    assert.ok(read.suspicion < SUSPICION_ALERT, `vrai avis non signalé (${read.suspicion})`);
    const invalid = mergeAiAnalysis(local, { sentiment: "??", score: Number.NaN, aspects: [], suspicion: Number.NaN }, objectiveSuspicion(genuine));
    assert.equal(invalid.suspicion, local.suspicion, "lecture invalide : règles locales complètes");
    const fake = { text: "Horrible, sale, personnel impoli, à fuir absolument.", rating: 5 };
    assert.ok(mergeAiAnalysis(analyzeReview(fake), { sentiment: "negatif", score: -1, aspects: [], suspicion: 90 }, objectiveSuspicion(fake)).suspicion >= SUSPICION_ALERT, "note contredite vue par le modèle");
    const promo = { text: "Super salon, profitez de -50% sur www.promo-beaute.tn", rating: 5 };
    assert.ok(mergeAiAnalysis(analyzeReview(promo), { sentiment: "positif", score: 0.8, aspects: [], suspicion: 0 }, objectiveSuspicion(promo)).suspicion >= SUSPICION_ALERT, "le lien reste un indice objectif");
  });

  test("P5 : points d'attention du bon mode seulement, photo sans visage → nouvelle photo, peau saine → indice élevé", () => {
    const face = fromVision("visage", { quality: "ok", score: 30, issues: [{ key: "redness", level: "moderate" }, { key: "frizz", level: "light" }, { key: "pores", level: "huge" }] });
    assert.equal(face.kind, "result");
    if (face.kind === "result") {
      assert.deepEqual(face.issues, [{ key: "redness", level: "moderate" }], "frisottis (cheveux) et niveau inconnu écartés");
      assert.equal(face.score, 40, "indice borné à 40");
      assert.ok(face.terms.includes("apaisant"));
    }
    assert.deepEqual(fromVision("cheveux", { quality: "subject", score: 90, issues: [] }), { kind: "retake", reason: "subject" });
    assert.deepEqual(fromVision("visage", { quality: "dark", score: 90, issues: [] }), { kind: "retake", reason: "dark" });
    assert.deepEqual(fromVision("visage", { quality: "??", score: 90, issues: [] }), { kind: "retake", reason: "subject" }, "qualité inconnue : nouvelle photo");
    const healthy = fromVision("cheveux", { quality: "ok", score: 70, issues: [] });
    assert.equal(healthy.kind === "result" && healthy.healthy && healthy.score >= 85, true);
  });

  test("P1 : classement du modèle limité aux salons connus, sans doublon, et respecté par le tri du score", () => {
    const salons = [
      { slug: "a", matchScore: 90 },
      { slug: "b", matchScore: 80 },
      { slug: "c", matchScore: 70 },
      { slug: "d", matchScore: 60 },
    ];
    const { ranked, rest } = applyAiRanking(salons, [
      { slug: "c", reason: "Vos soins habituels, près de chez vous" },
      { slug: "inconnu", reason: "inventé" },
      { slug: "c", reason: "doublon" },
      { slug: "a", reason: "Très bien noté" },
    ]);
    assert.deepEqual(ranked.map((s) => [s.slug, s.aiReason]), [["c", "Vos soins habituels, près de chez vous"], ["a", "Très bien noté"]]);
    const all = [...ranked, ...rest];
    assert.deepEqual([...all].sort((x, y) => y.matchScore - x.matchScore).map((s) => s.slug), ["c", "a", "b", "d"]);
  });
});
