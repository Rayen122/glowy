import "./setup";
import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { bayesianRating, buildProfile, emptyProfile, recommend, type SalonFeatures } from "@/modules/catalog/domain/recommend";
import { closeDb } from "./helpers";

const salon = (extra: Partial<SalonFeatures>): SalonFeatures => ({ id: "x", category: "coiffure", city: "Tunis", rating: 4.5, reviews: 20, priceFrom: 30, services: ["Coupe"], slotsToday: 2, calm: true, ...extra });

describe("IA P1 : recommandation de salons", () => {
  after(closeDb);

  test("note bayésienne : peu d'avis → ramenée vers 4", () => {
    assert.equal(bayesianRating(5, 1), (4 * 5 + 5) / 6);
    assert.ok(bayesianRating(4.8, 200) > bayesianRating(5, 2));
  });

  test("profil : la catégorie préférée et la prestation déjà réservée passent devant", () => {
    const profile = buildProfile({
      visits: [
        { category: "ongles", services: ["Manucure"], total: 40, city: "Sousse" },
        { category: "ongles", services: ["Manucure"], total: 50, city: "Sousse" },
      ],
      favorites: [],
      city: null,
    });
    assert.equal(profile.city, "Sousse");
    const [nails, hair] = recommend(
      [salon({ id: "nails", category: "ongles", city: "Sousse", services: ["Manucure"], rating: 4.2 }), salon({ id: "hair", category: "coiffure", city: "Tunis", rating: 4.9, reviews: 300 })],
      profile
    );
    assert.ok(nails.score > hair.score);
    assert.equal(nails.source, "profile");
    assert.equal(nails.reason.key, "category");
  });

  test("sans historique : repli sur la popularité et la ville", () => {
    const [near, far] = recommend([salon({ id: "near", city: "Sfax" }), salon({ id: "far", city: "Bizerte" })], { ...emptyProfile(), city: "Sfax" });
    assert.equal(near.source, "popularity");
    assert.equal(near.reason.key, "city");
    assert.ok(near.score > far.score);
  });
});
