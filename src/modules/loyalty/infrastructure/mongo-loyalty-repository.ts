import { idOf, objectId, PointRule, PointTransaction, Redemption, Reward, User, withTransaction } from "@/infrastructure/db";
import type { LoyaltyRepository } from "../application/ports";

export const mongoLoyaltyRepository: LoyaltyRepository = {
  async rule(reason) {
    const rule = await PointRule.findOne({ reason }).lean();
    return rule ? { points: rule.points, active: rule.active, monthlyCap: rule.monthlyCap ?? null } : null;
  },

  countSince: (userId, reason, since, salonId) =>
    PointTransaction.countDocuments({ user: objectId(userId), reason, createdAt: { $gte: since }, ...(salonId ? { salon: objectId(salonId) } : {}) }),

  hasEntry: async (userId, reason, ref = {}) =>
    (await PointTransaction.exists({
      user: objectId(userId),
      reason,
      ...(ref.bookingId ? { booking: objectId(ref.bookingId) } : {}),
      ...(ref.reviewId ? { review: objectId(ref.reviewId) } : {}),
    })) !== null,

  async account(userId) {
    const user = await User.findById(objectId(userId), { loyalty: 1 }).orFail().lean();
    return { balance: user.loyalty?.balance ?? 0, lifetime: user.loyalty?.lifetime ?? 0, lastActivityAt: user.loyalty?.lastActivityAt ?? user.createdAt };
  },

  record: ({ userId, points, reason, salonId, bookingId, reviewId, label, at }) =>
    withTransaction(async (session) => {
      const user = objectId(userId)!;
      await PointTransaction.create(
        [{ user, points, reason, salon: objectId(salonId) ?? undefined, booking: objectId(bookingId) ?? undefined, review: objectId(reviewId) ?? undefined, label: label ?? null, createdAt: at }],
        { session }
      );
      // Solde jamais négatif après une pénalité ; le cumul (niveau) ne compte que les gains
      await User.updateOne(
        { _id: user },
        [
          {
            $set: {
              "loyalty.balance": { $max: [0, { $add: [{ $ifNull: ["$loyalty.balance", 0] }, points] }] },
              "loyalty.lifetime": { $add: [{ $ifNull: ["$loyalty.lifetime", 0] }, Math.max(points, 0)] },
              "loyalty.lastActivityAt": at,
            },
          },
        ],
        { session, updatePipeline: true }
      );
    }),

  async reward(id) {
    const _id = objectId(id);
    const reward = _id ? await Reward.findById(_id).lean() : null;
    return reward ? { id: idOf(reward), label: reward.label, cost: reward.cost, active: reward.active } : null;
  },

  redeem: (userId, reward, code, at) =>
    withTransaction(async (session) => {
      const user = objectId(userId)!;
      // Décrément conditionnel : impossible de passer sous zéro, même avec deux échanges simultanés
      const updated = await User.updateOne(
        { _id: user, "loyalty.balance": { $gte: reward.cost } },
        { $inc: { "loyalty.balance": -reward.cost }, $set: { "loyalty.lastActivityAt": at } },
        { session }
      );
      if (updated.modifiedCount === 0) return null;
      await PointTransaction.create([{ user, points: -reward.cost, reason: "REDEMPTION", label: reward.label, createdAt: at }], { session });
      const [redemption] = await Redemption.create([{ user, reward: objectId(reward.id)!, points: reward.cost, code }], { session });
      return { id: idOf(redemption), code: redemption.code, points: redemption.points };
    }),

  staleAccounts: async (before) =>
    (await User.find({ "loyalty.lastActivityAt": { $lt: before }, "loyalty.balance": { $gt: 0 } }, { loyalty: 1 }).lean()).map((u) => ({
      userId: idOf(u),
      balance: u.loyalty?.balance ?? 0,
    })),
};
