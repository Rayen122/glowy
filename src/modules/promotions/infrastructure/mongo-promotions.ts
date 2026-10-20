import type { PromotionKind } from "@/core/domain/enums";
import { conflict, notFound } from "@/core/domain/errors";
import { Booking, idOf, objectId, Promotion, Redemption, Reward, User, type PromotionDoc } from "@/infrastructure/db";
import type { PromotionInput, SalonRewardInput } from "../application/schemas";
import type { PromotionRule } from "../domain/promotion";

/** SAL-10 et FID-06 : promotions et récompenses propres au salon, en base MongoDB */

const toRule = (p: PromotionDoc): PromotionRule => ({
  id: idOf(p),
  kind: p.kind as PromotionKind,
  code: p.code ?? null,
  label: p.label,
  percent: p.percent ?? null,
  amount: p.amount ?? null,
  minTotal: p.minTotal,
  startsOn: p.startsOn ?? null,
  endsOn: p.endsOn ?? null,
  withinHours: p.withinHours ?? null,
  maxUses: p.maxUses ?? null,
  uses: p.uses,
  active: p.active,
});

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;
const codeTaken = () => conflict("CODE_TAKEN", "Ce code existe déjà dans votre salon.");

export const mongoPromotions = {
  byCode: async (salonId: string, code: string) => {
    const p = await Promotion.findOne({ salon: objectId(salonId), code }).lean();
    return p ? toRule(p) : null;
  },
  lastMinuteOffers: async (salonId: string) => (await Promotion.find({ salon: objectId(salonId), kind: "LAST_MINUTE", active: true }).lean()).map(toRule),
  /** Réserve une utilisation sans dépasser maxUses, même avec des réservations simultanées */
  consume: async (id: string) => {
    const result = await Promotion.updateOne(
      { _id: objectId(id), active: true, $or: [{ maxUses: null }, { $expr: { $lt: ["$uses", "$maxUses"] } }] },
      { $inc: { uses: 1 } }
    );
    return result.modifiedCount === 1;
  },
  release: async (id: string) => {
    await Promotion.updateOne({ _id: objectId(id), uses: { $gt: 0 } }, { $inc: { uses: -1 } });
  },
};

export async function listSalonPromotions(salonId: string) {
  return (await Promotion.find({ salon: objectId(salonId) }).sort({ active: -1, createdAt: -1 }).lean()).map(toRule);
}

const toFields = (input: PromotionInput) => ({ ...input, code: input.kind === "CODE" ? input.code : null, withinHours: input.kind === "LAST_MINUTE" ? input.withinHours : null });

export async function createPromotion(salonId: string, input: PromotionInput) {
  try {
    return toRule((await Promotion.create({ salon: objectId(salonId)!, ...toFields(input) })).toObject());
  } catch (error) {
    if (isDuplicateKey(error)) throw codeTaken();
    throw error;
  }
}

export async function updatePromotion(salonId: string, id: string, input: PromotionInput) {
  try {
    const updated = await Promotion.findOneAndUpdate({ _id: objectId(id), salon: objectId(salonId) }, { $set: toFields(input) }, { returnDocument: "after" }).lean();
    if (!updated) throw notFound("Promotion introuvable.");
    return toRule(updated);
  } catch (error) {
    if (isDuplicateKey(error)) throw codeTaken();
    throw error;
  }
}

/** Une promotion déjà utilisée est désactivée (les réservations gardent sa trace) ; sinon supprimée */
export async function deletePromotion(salonId: string, id: string) {
  const _id = objectId(id);
  const promo = await Promotion.findOne({ _id, salon: objectId(salonId) }).lean();
  if (!promo) throw notFound("Promotion introuvable.");
  if (promo.uses > 0 || (await Booking.exists({ "promo.promotion": _id }))) {
    await Promotion.updateOne({ _id }, { $set: { active: false } });
    return { id, deleted: false };
  }
  await Promotion.deleteOne({ _id });
  return { id, deleted: true };
}

/** Offres visibles sur la page du salon : dernière minute active */
export async function publicOffers(salonId: string) {
  return (await Promotion.find({ salon: objectId(salonId), kind: "LAST_MINUTE", active: true }).lean())
    .map(toRule)
    .map((p) => ({ id: p.id, label: p.label, percent: p.percent, amount: p.amount, withinHours: p.withinHours ?? 0 }));
}

// ── FID-06 : récompenses du salon ───────────────────────────
export async function listSalonRewards(salonId: string) {
  const salon = objectId(salonId);
  const rewards = await Reward.find({ salon }).sort({ active: -1, cost: 1 }).lean();
  const counts = await Redemption.aggregate<{ _id: unknown; total: number; used: number }>([
    { $match: { reward: { $in: rewards.map((r) => r._id) } } },
    { $group: { _id: "$reward", total: { $sum: 1 }, used: { $sum: { $cond: [{ $ne: ["$usedAt", null] }, 1, 0] } } } },
  ]);
  return rewards.map((r) => {
    const c = counts.find((x) => String(x._id) === idOf(r));
    return { id: idOf(r), label: r.label, cost: r.cost, active: r.active, redeemed: c?.total ?? 0, used: c?.used ?? 0 };
  });
}

export type SalonReward = Awaited<ReturnType<typeof listSalonRewards>>[number];

export async function createSalonReward(salonId: string, input: SalonRewardInput) {
  const reward = await Reward.create({ salon: objectId(salonId)!, ...input });
  return { id: idOf(reward) };
}

export async function updateSalonReward(salonId: string, id: string, input: SalonRewardInput) {
  const updated = await Reward.findOneAndUpdate({ _id: objectId(id), salon: objectId(salonId) }, { $set: input }, { returnDocument: "after" }).lean();
  if (!updated) throw notFound("Récompense introuvable.");
  return { id };
}

/** Récompense déjà échangée : désactivée (les codes émis restent valables) ; sinon supprimée */
export async function deleteSalonReward(salonId: string, id: string) {
  const _id = objectId(id);
  const reward = await Reward.findOne({ _id, salon: objectId(salonId) }).lean();
  if (!reward) throw notFound("Récompense introuvable.");
  if (await Redemption.exists({ reward: _id })) {
    await Reward.updateOne({ _id }, { $set: { active: false } });
    return { id, deleted: false };
  }
  await Reward.deleteOne({ _id });
  return { id, deleted: true };
}

/**
 * Validation au comptoir du code présenté par la cliente : une seule fois, et seulement pour une récompense
 * de ce salon ou du catalogue Glowy (valable dans tous les salons).
 */
export async function redeemAtCounter(salonId: string, code: string, now = new Date()) {
  const redemption = await Redemption.findOne({ code: code.trim().toUpperCase() }).lean();
  const reward = redemption ? await Reward.findById(redemption.reward).lean() : null;
  if (!redemption || !reward || (reward.salon && String(reward.salon) !== salonId)) throw notFound("Code de récompense inconnu pour ce salon.");
  const updated = await Redemption.findOneAndUpdate({ _id: redemption._id, usedAt: null }, { $set: { usedAt: now } }, { returnDocument: "after" }).lean();
  if (!updated) throw conflict("ALREADY_USED", "Ce code a déjà été utilisé.");
  const user = await User.findById(redemption.user, { firstName: 1, lastName: 1 }).lean();
  return { code: updated.code, reward: reward.label, client: user ? `${user.firstName} ${user.lastName}`.trim() : "", usedAt: now };
}
