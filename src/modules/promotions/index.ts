/**
 * Module Promotions (P2) — API publique : codes promo et offres de dernière minute (SAL-10),
 * récompenses fidélité propres au salon et validation des codes au comptoir (FID-06).
 */
import { systemClock, type Clock } from "@/core/domain/clock";
import { makePromotions } from "./application/use-cases";
import { mongoPromotions } from "./infrastructure/mongo-promotions";

export const createPromotionsModule = (overrides: { clock?: Clock } = {}) => makePromotions({ promotions: mongoPromotions, clock: overrides.clock ?? systemClock });

export const { quote: quotePromotion, consume: consumePromotion, release: releasePromotion } = createPromotionsModule();

export {
  createPromotion,
  createSalonReward,
  deletePromotion,
  deleteSalonReward,
  listSalonPromotions,
  listSalonRewards,
  publicOffers,
  updatePromotion,
  updateSalonReward,
  redeemAtCounter,
  type SalonReward,
} from "./infrastructure/mongo-promotions";
export { promotionInput, redemptionCodeInput, salonRewardInput, type PromotionInput, type SalonRewardInput } from "./application/schemas";
export { bestLastMinute, checkPromotion, discountFor, normalizeCode, type PromotionRule } from "./domain/promotion";
export type { AppliedPromotion } from "./application/use-cases";
