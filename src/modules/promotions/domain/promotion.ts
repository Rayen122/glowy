import type { PromotionKind } from "@/core/domain/enums";
import { utcToTunis } from "@/core/domain/time";

/** SAL-10 : règles d'une promotion — pures, testées dans tests/promotions.test.ts */

export type PromotionRule = {
  id: string;
  kind: PromotionKind;
  code: string | null;
  label: string;
  percent: number | null;
  amount: number | null;
  minTotal: number;
  startsOn: string | null;
  endsOn: string | null;
  withinHours: number | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
};

export type PromotionCheck = "OK" | "INACTIVE" | "NOT_STARTED" | "EXPIRED" | "EXHAUSTED" | "MIN_TOTAL" | "NOT_LAST_MINUTE";

export const PROMO_MESSAGES: Record<Exclude<PromotionCheck, "OK">, string> = {
  INACTIVE: "Ce code promo n'est plus actif.",
  NOT_STARTED: "Ce code promo n'est pas encore valable.",
  EXPIRED: "Ce code promo a expiré.",
  EXHAUSTED: "Ce code promo a atteint son nombre d'utilisations.",
  MIN_TOTAL: "Montant minimum non atteint pour ce code promo.",
  NOT_LAST_MINUTE: "Offre réservée aux créneaux de dernière minute.",
};

/** Code saisi par la cliente : sans espaces, en majuscules */
export const normalizeCode = (code: string) => code.replace(/\s+/g, "").toUpperCase();

/** Remise en dinars, arrondie au dinar et jamais supérieure au montant */
export function discountFor(p: Pick<PromotionRule, "percent" | "amount">, subtotal: number) {
  const raw = p.percent ? (subtotal * p.percent) / 100 : (p.amount ?? 0);
  return Math.max(0, Math.min(subtotal, Math.round(raw)));
}

/** La promotion s'applique-t-elle à cette réservation, faite maintenant pour un créneau startsAt ? */
export function checkPromotion(p: PromotionRule, ctx: { subtotal: number; startsAt: Date; now: Date }): PromotionCheck {
  if (!p.active) return "INACTIVE";
  const today = utcToTunis(ctx.now).date;
  if (p.startsOn && today < p.startsOn) return "NOT_STARTED";
  if (p.endsOn && today > p.endsOn) return "EXPIRED";
  if (p.maxUses != null && p.uses >= p.maxUses) return "EXHAUSTED";
  if (ctx.subtotal < p.minTotal) return "MIN_TOTAL";
  if (p.kind === "LAST_MINUTE") {
    const ahead = ctx.startsAt.getTime() - ctx.now.getTime();
    if (ahead < 0 || ahead > (p.withinHours ?? 0) * 3_600_000) return "NOT_LAST_MINUTE";
  }
  return "OK";
}

/** Meilleure offre de dernière minute applicable, ou null */
export function bestLastMinute(offers: PromotionRule[], ctx: { subtotal: number; startsAt: Date; now: Date }) {
  return (
    offers
      .filter((p) => p.kind === "LAST_MINUTE" && checkPromotion(p, ctx) === "OK")
      .map((p) => ({ promotion: p, discount: discountFor(p, ctx.subtotal) }))
      .sort((a, b) => b.discount - a.discount)[0] ?? null
  );
}
