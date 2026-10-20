import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Notification, Product } from "@/infrastructure/db";
import { createProduct, deleteProduct, listProducts, lowStockCount, moveStock, productInput } from "@/modules/dashboard";
import { closeDb, makeSalon, resetDb } from "./helpers";

describe("Stocks avec alerte de stock bas (SAL-12)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("entrées et sorties, jamais de stock négatif, alerte au passage sous le seuil", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const product = await createProduct(salon.id, productInput.parse({ name: "Shampoing 1 L", threshold: 2 }), 4);
    assert.equal(product.low, false);

    await moveStock(owner, salon.id, product.id, { delta: -1, reason: "OUT" });
    assert.equal(await Notification.countDocuments({ type: "stock.low" }), 0);
    const low = await moveStock(owner, salon.id, product.id, { delta: -1, reason: "OUT" });
    assert.deepEqual([low.quantity, low.low], [2, true]);
    assert.equal(await Notification.countDocuments({ user: owner.id, type: "stock.low" }), 1, "une alerte au franchissement du seuil");
    await moveStock(owner, salon.id, product.id, { delta: -1, reason: "SALE" });
    assert.equal(await Notification.countDocuments({ type: "stock.low" }), 1, "pas de nouvelle alerte tant qu'on reste sous le seuil");

    await assert.rejects(moveStock(owner, salon.id, product.id, { delta: -5, reason: "OUT" }), (e: AppError) => e.code === "INSUFFICIENT_STOCK");
    await moveStock(owner, salon.id, product.id, { delta: 10, reason: "IN" });
    assert.equal(await lowStockCount(salon.id), 0);
    assert.equal((await listProducts(salon.id)).movements.length, 4);
  });

  test("un produit mouvementé est désactivé au lieu d'être supprimé ; nom unique par salon", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const used = await createProduct(salon.id, productInput.parse({ name: "Vernis rouge" }), 3);
    const unused = await createProduct(salon.id, productInput.parse({ name: "Gants" }), 0);
    await moveStock(owner, salon.id, used.id, { delta: -1, reason: "OUT" });
    assert.deepEqual(await deleteProduct(salon.id, used.id), { id: used.id, deleted: false });
    assert.equal((await Product.findById(used.id).orFail()).active, false);
    assert.deepEqual(await deleteProduct(salon.id, unused.id), { id: unused.id, deleted: true });
    await assert.rejects(createProduct(salon.id, productInput.parse({ name: "Vernis rouge" })), (e: AppError) => e.code === "PRODUCT_EXISTS");
  });
});
