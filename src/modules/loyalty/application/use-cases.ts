import type { Clock } from "@/core/domain/clock";
import type { PointReason } from "@/core/domain/enums";
import { conflict, notFound } from "@/core/domain/errors";
import { CAP_PER_SALON, DEFAULT_RULES, inactivityLimit, redemptionCode, startOfMonth, withTierBonus } from "../domain/rules";
import type { LoyaltyRepository } from "./ports";

export type AwardOptions = { salonId?: string; bookingId?: string; reviewId?: string; label?: string };

/** Moteur de fidélité : toute variation de points passe par award() ou redeem() (grand livre + compte). */
export function makeLoyalty({ ledger, clock }: { ledger: LoyaltyRepository; clock: Clock }) {
  async function ruleFor(reason: PointReason) {
    const fallback = DEFAULT_RULES[reason];
    return (await ledger.rule(reason)) ?? { points: fallback.points, active: true, monthlyCap: fallback.monthlyCap ?? null };
  }

  /**
   * Crédite (ou débite) des points selon le barème. Renvoie les points réellement appliqués
   * (0 si la règle est désactivée ou le plafond mensuel atteint).
   */
  async function award(userId: string, reason: PointReason, opts: AwardOptions = {}) {
    const now = clock.now();
    const rule = await ruleFor(reason);
    if (!rule.active || rule.points === 0) return 0;
    if (rule.monthlyCap != null) {
      const used = await ledger.countSince(userId, reason, startOfMonth(now), CAP_PER_SALON.includes(reason) ? opts.salonId : undefined);
      if (used >= rule.monthlyCap) return 0;
    }
    const account = await ledger.account(userId);
    const points = withTierBonus(rule.points, account.lifetime);
    await ledger.record({ userId, points, reason, ...opts, at: now });
    return points;
  }

  /** Déjà crédité pour cette réservation / cet avis ? (rend les réactions aux événements idempotentes) */
  const alreadyAwarded = (userId: string, reason: PointReason, ref: { bookingId?: string; reviewId?: string }) => ledger.hasEntry(userId, reason, ref);

  /** Bonus unique (profil complété…) */
  async function awardOnce(userId: string, reason: PointReason) {
    return (await ledger.hasEntry(userId, reason)) ? 0 : award(userId, reason);
  }

  /** FID-04 : échange de points contre une récompense ; renvoie le code à présenter au salon */
  async function redeem(userId: string, rewardId: string) {
    const reward = await ledger.reward(rewardId);
    if (!reward?.active) throw notFound("Récompense introuvable.");
    const redemption = await ledger.redeem(userId, reward, redemptionCode(), clock.now());
    if (!redemption) throw conflict("INSUFFICIENT_POINTS", "Solde de points insuffisant.");
    return redemption;
  }

  /** FID-07 : expiration après 12 mois d'inactivité — à appeler par une tâche planifiée */
  async function expireInactivePoints() {
    const now = clock.now();
    const stale = await ledger.staleAccounts(inactivityLimit(now));
    for (const account of stale) await ledger.record({ userId: account.userId, points: -account.balance, reason: "EXPIRATION", at: now });
    return stale.length;
  }

  return { award, alreadyAwarded, awardOnce, redeem, expireInactivePoints };
}

export type Loyalty = ReturnType<typeof makeLoyalty>;
