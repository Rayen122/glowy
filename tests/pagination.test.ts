import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pageItems, paginate } from "@/lib/pagination";

describe("Pagination", () => {
  test("numéros affichés : première, dernière, page courante et voisines", () => {
    assert.deepEqual(pageItems(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageItems(2, 10), [1, 2, 3, 4, 5, "gap", 10]);
    assert.deepEqual(pageItems(5, 10), [1, "gap", 4, 5, 6, "gap", 10]);
    assert.deepEqual(pageItems(9, 10), [1, "gap", 6, 7, 8, 9, 10]);
    // Téléphone : 5 éléments au plus
    assert.deepEqual(pageItems(5, 10, 5), [1, "gap", 5, "gap", 10]);
    assert.deepEqual(pageItems(2, 10, 5), [1, 2, 3, "gap", 10]);
    for (let page = 1; page <= 30; page++) {
      assert.ok(pageItems(page, 30).length <= 7);
      assert.ok(pageItems(page, 30, 5).length <= 5);
      assert.ok(pageItems(page, 30, 5).includes(page), "la page courante est toujours visible");
    }
  });

  test("bornes : page inexistante ramenée à la dernière, liste vide = 1 page", () => {
    assert.deepEqual(paginate(13, 6, 2), { page: 2, pages: 3, start: 6, end: 12 });
    assert.deepEqual(paginate(13, 6, 99), { page: 3, pages: 3, start: 12, end: 18 });
    assert.deepEqual(paginate(0, 6, 1), { page: 1, pages: 1, start: 0, end: 6 });
    assert.equal(paginate(13, 6, -4).page, 1);
  });
});
