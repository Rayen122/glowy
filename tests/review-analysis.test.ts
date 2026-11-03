import "./setup";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { analyzeReview, summarizeReviews, SUSPICION_ALERT } from "@/modules/reviews";
import { closeDb } from "./helpers";

describe("IA P4 : analyse des avis (sentiment, aspects, suspicion)", () => {
  after(closeDb);

  test("français : sentiment, aspects et négation", () => {
    const good = analyzeReview({ text: "Accueil chaleureux et coupe parfaite, je recommande !", rating: 5 });
    assert.equal(good.sentiment, "positif");
    assert.deepEqual(good.aspects, [{ aspect: "accueil", polarity: 1 }, { aspect: "resultat", polarity: 1 }]);
    const bad = analyzeReview({ text: "Le salon n'était pas propre. Une heure d'attente, très déçue.", rating: 2 });
    assert.equal(bad.sentiment, "negatif");
    assert.ok(bad.aspects.some((a) => a.aspect === "proprete" && a.polarity === -1), "« pas propre » est négatif");
    assert.ok(bad.aspects.some((a) => a.aspect === "attente" && a.polarity === -1));
  });

  test("anglais, arabe, emojis et repli sur la note", () => {
    assert.equal(analyzeReview({ text: "Amazing colour, friendly staff", rating: 5 }).sentiment, "positif");
    assert.equal(analyzeReview({ text: "خدمة ممتازة والصالون نظيف", rating: 5 }).sentiment, "positif");
    assert.equal(analyzeReview({ text: "Brushing 😍😍", rating: 4 }).source, "lexicon");
    const neutral = analyzeReview({ text: "Rendez-vous de 14 h avec Amira", rating: 3 });
    assert.deepEqual([neutral.sentiment, neutral.source], ["neutre", "rating"]);
  });

  test("suspicion : lien publicitaire, texte creux, note contredite", () => {
    assert.ok(analyzeReview({ text: "Super salon, visitez www.promo-beaute.com", rating: 5 }).suspicion >= 35);
    assert.ok(analyzeReview({ text: "Nul", rating: 1 }).suspicion >= 30);
    assert.ok(analyzeReview({ text: "Horrible, sale et déçue, à éviter", rating: 5 }).suspicion >= 30);
    assert.equal(analyzeReview({ text: "Très bonne coupe, un peu d'attente le samedi.", rating: 4 }).suspicion, 0);
  });

  test("derja en arabizi et négation française « ne … pas » comprises sans la note", () => {
    assert.equal(analyzeReview({ text: "Behi barcha, el coiffeuse mezyena", rating: 3 }).sentiment, "positif");
    assert.equal(analyzeReview({ text: "Khayeb barcha, ma3jebnich jemla", rating: 3 }).sentiment, "negatif");
    assert.equal(analyzeReview({ text: "3adi, mouch khayeb mouch behi", rating: 3 }).sentiment, "neutre");
    assert.equal(analyzeReview({ text: "Je ne recommande pas du tout.", rating: 3 }).sentiment, "negatif");
  });

  test("alerte « avis suspect » : faux avis signalés, vrais avis jamais (seuil SUSPICION_ALERT)", () => {
    const score = (text: string, rating: number) => analyzeReview({ text, rating }).suspicion;
    for (const [text, rating] of [["TOP TOP TOP MEILLEUR SALON DE TUNIS", 5], ["Parfait parfait parfait parfait parfait parfait parfait", 5], ["Excellent", 1], ["Horrible, sale, impolie, à fuir", 5], ["Promo sur www.beaute-pas-chere.com", 5]] as const)
      assert.ok(score(text, rating) >= SUSPICION_ALERT, text);
    for (const [text, rating] of [["Top !", 5], ["Très très très bien", 5], ["Super, encore 45 minutes de retard… merci pour rien.", 1], ["Très déçue, coupe ratée et personne ne s'est excusé.", 1]] as const)
      assert.ok(score(text, rating) < SUSPICION_ALERT, text);
  });

  test("synthèse : points forts récurrents et points faibles", () => {
    const s = summarizeReviews([
      { sentiment: "positif", aspects: [{ aspect: "accueil", polarity: 1 }, { aspect: "resultat", polarity: 1 }] },
      { sentiment: "positif", aspects: [{ aspect: "accueil", polarity: 1 }, { aspect: "resultat", polarity: 1 }] },
      { sentiment: "positif", aspects: [{ aspect: "accueil", polarity: 1 }] },
      { sentiment: "negatif", aspects: [{ aspect: "attente", polarity: -1 }] },
    ]);
    assert.deepEqual(s.sentiment, { positif: 75, neutre: 0, negatif: 25 });
    assert.deepEqual(s.strengths, ["accueil", "resultat"]);
    assert.deepEqual(s.weaknesses, ["attente"]);
  });
});
