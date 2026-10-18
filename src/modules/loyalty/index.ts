/**
 * Module Fidélité (P5) — API publique.
 * Câblage : moteur de points ← grand livre MongoDB ; réactions aux événements → notifications.
 */
import { systemClock, type Clock } from "@/core/domain/clock";
import type { EventSubscriber } from "@/core/domain/events";
import { notify, pointsEarned } from "@/modules/notifications";
import { registerLoyaltySubscribers } from "./application/subscribers";
import { makeLoyalty } from "./application/use-cases";
import { mongoLoyaltyFacts } from "./infrastructure/mongo-loyalty-facts";
import { mongoLoyaltyRepository } from "./infrastructure/mongo-loyalty-repository";

export const createLoyaltyModule = (overrides: { clock?: Clock } = {}) => makeLoyalty({ ledger: mongoLoyaltyRepository, clock: overrides.clock ?? systemClock });

const loyalty = createLoyaltyModule();
export const { award, alreadyAwarded, awardOnce, redeem, expireInactivePoints } = loyalty;

export const registerSubscribers = (bus: EventSubscriber) =>
  registerLoyaltySubscribers(bus, { loyalty, facts: mongoLoyaltyFacts, notifyPoints: (userId, points, body) => notify(userId, pointsEarned(points, body)) });

export { getAccount, getLoyaltyPage, getLoyaltySummary } from "./infrastructure/queries";
export { DEFAULT_RULES, HISTORY_KEY, SALON_MILESTONES, TIERS, tierFor } from "./domain/rules";
