import { randomBytes } from "node:crypto";
import { conflict, notFound } from "@/core/domain/errors";
import { Booking, idOf, isDuplicateKey, objectId, Redemption, Reward, Salon, SalonPointEntry, SalonWallet, withTransaction } from "@/infrastructure/db";

/**
 * FID-06 : points salon (locaux), distincts des points Glowy. Chaque salon fixe le nombre de points
 * crédités par visite terminée ; la cliente les échange contre les récompenses de ce salon.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const salonRewardCode = () => `SP-${[...randomBytes(6)].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;

/** Abonné à booking.completed : crédite la visite une seule fois (index unique sur la réservation) */
export async function creditVisit(bookingId: string) {
  const booking = await Booking.findById(objectId(bookingId), { client: 1, salon: 1, status: 1 }).lean();
  if (!booking || booking.status !== "COMPLETED") return null;
  const salon = await Salon.findById(booking.salon, { name: 1, salonPointsPerVisit: 1 }).lean();
  const points = salon?.salonPointsPerVisit ?? 0;
  if (!salon || points <= 0) return null;
  try {
    return await withTransaction(async (session) => {
      await SalonPointEntry.create([{ salon: booking.salon, user: booking.client, points, reason: "VISIT", booking: booking._id, label: salon.name }], { session });
      await SalonWallet.updateOne({ salon: booking.salon, user: booking.client }, { $inc: { balance: points, lifetime: points } }, { upsert: true, session });
      return { points };
    });
  } catch (error) {
    if (isDuplicateKey(error)) return null; // déjà crédité
    throw error;
  }
}

/** Portefeuilles de la cliente : solde par salon et récompenses de chaque salon */
export async function salonWallets(userId: string) {
  const user = objectId(userId);
  const wallets = await SalonWallet.find({ user, lifetime: { $gt: 0 } }).sort({ balance: -1 }).lean();
  const [salons, rewards] = await Promise.all([
    Salon.find({ _id: { $in: wallets.map((w) => w.salon) } }, { name: 1, slug: 1, salonPointsPerVisit: 1 }).lean(),
    Reward.find({ salon: { $in: wallets.map((w) => w.salon) }, active: true }).sort({ cost: 1 }).lean(),
  ]);
  return wallets.flatMap((w) => {
    const salon = salons.find((s) => s._id.equals(w.salon));
    if (!salon) return [];
    return [
      {
        salon: { id: idOf(salon), name: salon.name, slug: salon.slug, perVisit: salon.salonPointsPerVisit },
        balance: w.balance,
        lifetime: w.lifetime,
        rewards: rewards.filter((r) => r.salon?.equals(w.salon)).map((r) => ({ id: idOf(r), label: r.label, cost: r.cost })),
      },
    ];
  });
}

export type SalonWalletView = Awaited<ReturnType<typeof salonWallets>>[number];

/** Échange de points salon contre une récompense du même salon ; renvoie le code à présenter au comptoir */
export async function redeemSalonReward(userId: string, rewardId: string) {
  const reward = await Reward.findOne({ _id: objectId(rewardId), salon: { $ne: null }, active: true }).lean();
  const salon = reward?.salon;
  if (!reward || !salon) throw notFound("Récompense introuvable.");
  const user = objectId(userId)!;
  return withTransaction(async (session) => {
    const spent = await SalonWallet.updateOne({ user, salon, balance: { $gte: reward.cost } }, { $inc: { balance: -reward.cost } }, { session });
    if (spent.modifiedCount === 0) throw conflict("INSUFFICIENT_POINTS", "Points salon insuffisants.");
    await SalonPointEntry.create([{ salon, user, points: -reward.cost, reason: "REDEMPTION", label: reward.label }], { session });
    const [redemption] = await Redemption.create([{ user, reward: reward._id, points: reward.cost, code: salonRewardCode() }], { session });
    return { id: idOf(redemption), code: redemption.code, points: reward.cost };
  });
}

/** Réglage du gérant : points par visite (0 désactive le programme) et vue d'ensemble */
export async function salonPointsOverview(salonId: string) {
  const salon = objectId(salonId);
  const [doc, stats] = await Promise.all([
    Salon.findById(salon, { salonPointsPerVisit: 1 }).lean(),
    SalonWallet.aggregate<{ members: number; outstanding: number }>([{ $match: { salon } }, { $group: { _id: null, members: { $sum: 1 }, outstanding: { $sum: "$balance" } } }]),
  ]);
  if (!doc) throw notFound("Salon introuvable.");
  return { perVisit: doc.salonPointsPerVisit, members: stats[0]?.members ?? 0, outstanding: stats[0]?.outstanding ?? 0 };
}

export async function setSalonPointsPerVisit(salonId: string, perVisit: number) {
  const updated = await Salon.updateOne({ _id: objectId(salonId) }, { $set: { salonPointsPerVisit: perVisit } });
  if (!updated.matchedCount) throw notFound("Salon introuvable.");
  return { perVisit };
}
