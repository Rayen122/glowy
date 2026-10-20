import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import { utcToTunis } from "@/core/domain/time";
import { idOf, isDuplicateKey, objectId, Product, Salon, StockMovement, User } from "@/infrastructure/db";
import type { ProductInput, StockMoveInput } from "../application/schemas";

/** SAL-12 : stocks du salon — produits, mouvements, alerte de stock bas (notification aux gérants) */

type Notifier = (userId: string, message: { type: string; title: string; body: string; link?: string }) => Promise<unknown>;

const view = (p: { _id: unknown; name: string; usage?: string | null; unit?: string | null; quantity: number; threshold: number; price?: number | null; active: boolean }) => ({
  id: String(p._id),
  name: p.name,
  usage: (p.usage ?? "salon") as "salon" | "vente",
  unit: p.unit ?? "pcs",
  quantity: p.quantity,
  threshold: p.threshold,
  price: p.price ?? null,
  active: p.active,
  low: p.active && p.quantity <= p.threshold,
});

export async function listProducts(salonId: string) {
  const salon = objectId(salonId);
  const [products, movements] = await Promise.all([
    Product.find({ salon }).sort({ active: -1, name: 1 }).lean(),
    StockMovement.find({ salon }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const users = await User.find({ _id: { $in: movements.map((m) => m.by).filter(Boolean) } }, { firstName: 1 }).lean();
  return {
    products: products.map(view),
    movements: movements.map((m) => ({
      id: idOf(m),
      product: products.find((p) => p._id.equals(m.product))?.name ?? "",
      delta: m.delta,
      reason: m.reason as StockMoveInput["reason"],
      note: m.note ?? null,
      by: users.find((u) => m.by && u._id.equals(m.by))?.firstName ?? null,
      at: utcToTunis(m.createdAt),
    })),
  };
}

export type StockOverview = Awaited<ReturnType<typeof listProducts>>;

export const lowStockCount = async (salonId: string) => {
  const products = await Product.find({ salon: objectId(salonId), active: true }, { quantity: 1, threshold: 1 }).lean();
  return products.filter((p) => p.quantity <= p.threshold).length;
};

const nameTaken = () => conflict("PRODUCT_EXISTS", "Un produit porte déjà ce nom.");

export async function createProduct(salonId: string, input: ProductInput, initialQuantity = 0) {
  try {
    const product = await Product.create({ salon: objectId(salonId)!, ...input, quantity: Math.max(0, initialQuantity) });
    return view(product.toObject());
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
}

export async function updateProduct(salonId: string, id: string, input: ProductInput) {
  try {
    const updated = await Product.findOneAndUpdate({ _id: objectId(id), salon: objectId(salonId) }, { $set: input }, { returnDocument: "after" }).lean();
    if (!updated) throw notFound("Produit introuvable.");
    return view(updated);
  } catch (error) {
    if (isDuplicateKey(error)) throw nameTaken();
    throw error;
  }
}

/** Produit déjà mouvementé : désactivé (historique conservé) ; sinon supprimé */
export async function deleteProduct(salonId: string, id: string) {
  const _id = objectId(id);
  const product = await Product.findOne({ _id, salon: objectId(salonId) }).lean();
  if (!product) throw notFound("Produit introuvable.");
  if (await StockMovement.exists({ product: _id })) {
    await Product.updateOne({ _id }, { $set: { active: false } });
    return { id, deleted: false };
  }
  await Product.deleteOne({ _id });
  return { id, deleted: true };
}

/**
 * Mouvement de stock, refusé s'il rendrait la quantité négative (décrément conditionnel, sûr en concurrence).
 * Passage sous le seuil : notification aux gérants du salon.
 */
export async function moveStock(actor: Actor, salonId: string, productId: string, input: StockMoveInput, notify: Notifier) {
  const salon = objectId(salonId)!;
  const before = await Product.findOne({ _id: objectId(productId), salon }).lean();
  if (!before) throw notFound("Produit introuvable.");
  const updated = await Product.findOneAndUpdate(
    { _id: before._id, salon, ...(input.delta < 0 ? { quantity: { $gte: -input.delta } } : {}) },
    { $inc: { quantity: input.delta } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) throw conflict("INSUFFICIENT_STOCK", "Stock insuffisant pour cette sortie.");
  await StockMovement.create({ salon, product: before._id, delta: input.delta, reason: input.reason, note: input.note ?? null, by: objectId(actor.id) });
  if (before.quantity > before.threshold && updated.quantity <= updated.threshold && updated.active) {
    const doc = await Salon.findById(salon, { owner: 1 }).lean();
    if (doc) await notify(String(doc.owner), { type: "stock.low", title: "Stock bas", body: `${updated.name} : il reste ${updated.quantity} ${updated.unit ?? ""}`.trim(), link: "/dashboard/stocks" });
  }
  return view(updated);
}
