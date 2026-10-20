import { Booking, idOf, objectId, PointTransaction, Review, Reward, Salon, User, type PointTransactionDoc } from "@/infrastructure/db";
import { nextTierFor, tierFor } from "../domain/rules";
import { mongoLoyaltyRepository } from "./mongo-loyalty-repository";

const toEntry = (t: PointTransactionDoc) => ({ id: idOf(t), points: t.points, reason: t.reason, label: t.label ?? null, createdAt: t.createdAt });

/** Catalogue Glowy + récompenses propres aux salons où la cliente est déjà venue (FID-06) */
async function catalog(userId: string) {
  const visited = await Booking.distinct("salon", { client: objectId(userId), status: "COMPLETED" });
  const rewards = await Reward.find({ active: true, $or: [{ salon: null }, { salon: { $in: visited } }] }).sort({ cost: 1 }).lean();
  const salons = await Salon.find({ _id: { $in: rewards.map((r) => r.salon).filter(Boolean) } }, { name: 1, slug: 1 }).lean();
  return rewards.map((r) => {
    const salon = r.salon ? salons.find((s) => s._id.equals(r.salon!)) : null;
    return { id: idOf(r), label: r.label, cost: r.cost, salon: salon ? { name: salon.name, slug: salon.slug } : null };
  });
}

const history = async (userId: string, take: number) =>
  (await PointTransaction.find({ user: objectId(userId) }).sort({ createdAt: -1 }).limit(take).lean()).map(toEntry);

export const getAccount = (userId: string) => mongoLoyaltyRepository.account(userId);

/** Solde, niveau, historique et catalogue (FID-01, FID-03, FID-04) */
export async function getLoyaltySummary(userId: string) {
  const [account, entries, rewards] = await Promise.all([getAccount(userId), history(userId, 30), catalog(userId)]);
  const next = nextTierFor(account.lifetime);
  return { balance: account.balance, lifetime: account.lifetime, tier: tierFor(account.lifetime).id, nextTier: next ? { id: next.id, min: next.min } : null, history: entries, rewards };
}

/** Page fidélité : historique, catalogue et badges calculés (FID-01, FID-04, FID-08) */
export async function getLoyaltyPage(userId: string) {
  const user = objectId(userId);
  const [account, entries, rewards, completed, reviews, referrals, noShows] = await Promise.all([
    getAccount(userId),
    history(userId, 20),
    catalog(userId),
    Booking.aggregate<{ _id: unknown; count: number }>([{ $match: { client: user, status: "COMPLETED" } }, { $group: { _id: "$salon", count: { $sum: 1 } } }]),
    Review.countDocuments({ client: user }),
    User.countDocuments({ referredBy: user }),
    Booking.countDocuments({ client: user, status: "NO_SHOW" }),
  ]);
  const totalCompleted = completed.reduce((a, c) => a + c.count, 0);
  const badges = [
    { id: "explorateur", label: "Explorateur", goal: "5 salons différents", progress: completed.length, target: 5 },
    { id: "ponctuel", label: "Ponctuel", goal: "10 RDV sans retard", progress: noShows ? 0 : totalCompleted, target: 10 },
    { id: "fidele", label: "Fidèle", goal: "10 RDV chez un salon", progress: Math.max(0, ...completed.map((c) => c.count)), target: 10 },
    { id: "critique", label: "Critique utile", goal: "10 avis", progress: reviews, target: 10 },
    { id: "ambassadeur", label: "Ambassadeur", goal: "3 parrainages", progress: referrals, target: 3 },
  ];
  return { account, history: entries, rewards, badges };
}
