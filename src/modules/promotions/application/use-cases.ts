import type { Clock } from "@/core/domain/clock";
import { badRequest } from "@/core/domain/errors";
import { bestLastMinute, checkPromotion, discountFor, normalizeCode, PROMO_MESSAGES, type PromotionRule } from "../domain/promotion";

export type PromotionRepository = {
  byCode(salonId: string, code: string): Promise<PromotionRule | null>;
  lastMinuteOffers(salonId: string): Promise<PromotionRule[]>;
  consume(id: string): Promise<boolean>;
  release(id: string): Promise<void>;
};

/** Promotion retenue pour une réservation */
export type AppliedPromotion = { promotionId: string; code: string | null; label: string; discount: number };

/**
 * SAL-10 : prix d'une réservation avec promotion (une seule remise, jamais cumulée).
 * Un code saisi est vérifié (refusé avec un message clair s'il ne s'applique pas) ; la cliente garde
 * ensuite la meilleure remise entre ce code et l'offre de dernière minute du salon.
 */
export function makePromotions({ promotions, clock }: { promotions: PromotionRepository; clock: Clock }) {
  async function quote(salonId: string, ctx: { code?: string | null; subtotal: number; startsAt: Date }): Promise<AppliedPromotion | null> {
    const now = clock.now();
    const code = ctx.code ? normalizeCode(ctx.code) : "";
    let withCode: AppliedPromotion | null = null;
    if (code) {
      const promo = await promotions.byCode(salonId, code);
      if (!promo || promo.kind !== "CODE") throw badRequest("PROMO_UNKNOWN", "Code promo inconnu pour ce salon.");
      const check = checkPromotion(promo, { subtotal: ctx.subtotal, startsAt: ctx.startsAt, now });
      if (check !== "OK") throw badRequest(`PROMO_${check}`, PROMO_MESSAGES[check]);
      withCode = { promotionId: promo.id, code: promo.code, label: promo.label, discount: discountFor(promo, ctx.subtotal) };
    }
    const best = bestLastMinute(await promotions.lastMinuteOffers(salonId), { subtotal: ctx.subtotal, startsAt: ctx.startsAt, now });
    const lastMinute = best && best.discount > 0 ? { promotionId: best.promotion.id, code: null, label: best.promotion.label, discount: best.discount } : null;
    return lastMinute && (!withCode || lastMinute.discount > withCode.discount) ? lastMinute : withCode;
  }

  return { quote, consume: promotions.consume, release: promotions.release };
}

export type PromotionUseCases = ReturnType<typeof makePromotions>;
