/**
 * Module Abonnements (ADM-05) — API publique : paiement des plans Pro / Premium validé par le Super Admin.
 * Câblage : cas d'usage ← dépôt MongoDB, accès au salon du module Identité, bus d'événements.
 */
import { systemClock } from "@/core/domain/clock";
import type { EventSubscriber } from "@/core/domain/events";
import { eventBus } from "@/infrastructure/event-bus";
import { staffSalonId } from "@/modules/identity";
import { registerSubscriptionSubscribers } from "./application/subscribers";
import { makeSubscription } from "./application/use-cases";
import { mongoSubscriptionRepository } from "./infrastructure/mongo-subscription-repository";

const subscription = makeSubscription({ subscriptions: mongoSubscriptionRepository, access: { staffSalonId }, events: eventBus, clock: systemClock });
export const { requestPlan, decide: decidePayment } = subscription;

export const registerSubscribers = (bus: EventSubscriber) => registerSubscriptionSubscribers(bus, { subscription });

export { decidePaymentInput, requestPlanInput } from "./application/schemas";
export { adminCounts, adminSubscriptions, planRevenue, salonSubscription, type AdminPaymentRow } from "./infrastructure/queries";
export { daysLeft } from "./domain/rules";
export { canAddEmployee, effectivePlan, minimumPlanFor, PLAN_LIMITS, planAllows, type PlanFeature } from "./domain/plans";
export { planAccess, requireEmployeeSlot, requirePlanFeature, salonPlan } from "./infrastructure/plan-access";
export { expirePlans, remindExpiringPlans } from "./infrastructure/plan-expiry";
export type { PlanPaymentRecord } from "./application/ports";
