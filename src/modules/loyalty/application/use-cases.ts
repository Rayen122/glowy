import type { Clock } from "@/core/domain/clock";
import type { PointReason } from "@/core/domain/enums";
import { conflict, notFound } from "@/core/domain/errors";
import { tunisDayRange, tunisToday } from "@/core/domain/time";
import { CAP_PER_SALON, DEFAULT_DAILY_CAP, DEFAULT_RULES, expiresOn, expiryWarningLimit, inactivityLimit, redemptionCode, startOfMonth, withTierBonus } from "../domain/rules";
import type { ExpiryNotices, LoyaltyRepository } from "./ports";

export type AwardOptions = { salonId?: string; bookingId?: string; reviewId?: string; label?: string };

/** Moteur de fidélité : toute variation de points passe par award() ou redeem() (grand livre + compte). */
const SILENT: ExpiryNotices = { expiring: async () => {}, expired: async () => {} };

export function makeLoyalty({ ledger, clock, notices = SILENT }: { ledger: LoyaltyRepository; clock: Clock; notices?: ExpiryNotices }) {
  async function ruleFor(reason: PointReason) {
    const fallback = DEFAULT_RULES[reason];
    return (await ledger.rule(reason)) ?? { points: fallback.points, active: true, monthlyCap: fallback.monthlyCap ?? null, dailyCap: null };
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
    // Anti-fraude : plafond quotidien par type d'action (les pénalités ne sont jamais plafonnées)
    if (rule.points > 0 && (await ledger.countSince(userId, reason, tunisDayRange(tunisToday(now)).start)) >= (rule.dailyCap ?? DEFAULT_DAILY_CAP)) return 0;
    const account = await ledger.account(userId);
    // Campagne « double points » en cours (ADM-09) : s'applique aux gains, jamais aux pénalités
    const boost = rule.points > 0 ? await ledger.multiplier(reason, now) : 1;
    const points = Math.round(withTierBonus(rule.points, account.lifetime) * boost);
    await ledger.record({ userId, points, reason, ...opts, at: now });
    return points;
  }

  /** Déjà crédité pour cette réservation / cet avis ? (rend les réactions aux événements idempotentes) */
  const alreadyAwarded = (userId: string, reason: PointReason, ref: { bookingId?: string; reviewId?: string }) => ledger.hasEntry(userId, reason, ref);

  /** Points gagnés grâce à un avis, déjà repris compris (0 après une reprise) */
  const reviewPoints = (userId: string, reviewId: string) => ledger.reviewPoints(userId, reviewId);

  /** Reprise de points accordés à tort (avis retiré) : ligne « ajustement » négative, solde jamais négatif */
  async function revoke(userId: string, points: number, opts: AwardOptions = {}) {
    if (points <= 0) return;
    await ledger.record({ userId, points: -points, reason: "ADJUSTMENT", ...opts, at: clock.now() });
  }

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
  /** FID-07 : points éternels interdits — expiration après 12 mois sans activité, la cliente est prévenue */
  async function expireInactivePoints() {
    const now = clock.now();
    const stale = await ledger.staleAccounts(inactivityLimit(now));
    for (const account of stale) {
      await ledger.record({ userId: account.userId, points: -account.balance, reason: "EXPIRATION", at: now });
      await notices.expired(account.userId, account.balance);
    }
    return stale.length;
  }

  /** FID-07 : préavis un mois avant l'expiration, une seule fois par période d'inactivité */
  async function warnExpiringPoints() {
    const now = clock.now();
    const accounts = await ledger.expiringAccounts(expiryWarningLimit(now), inactivityLimit(now));
    for (const account of accounts) {
      await notices.expiring(account.userId, account.balance, expiresOn(account.lastActivityAt));
      await ledger.markExpiryWarned(account.userId, now);
    }
    return accounts.length;
  }

  return { award, alreadyAwarded, awardOnce, reviewPoints, revoke, redeem, expireInactivePoints, warnExpiringPoints };
}

export type Loyalty = ReturnType<typeof makeLoyalty>;
