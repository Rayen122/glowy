import type { Actor } from "@/core/domain/actor";
import type { Clock } from "@/core/domain/clock";
import { PLAN_PRICES, type PaidPlan, type PlanPaymentChannel } from "@/core/domain/enums";
import { conflict, forbidden, notFound } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { isAlreadyCovered, paidUntil } from "../domain/rules";
import type { SubscriptionRepository } from "./ports";
import type { DecidePaymentInput, RequestPlanInput } from "./schemas";

export type SubscriptionDeps = {
  subscriptions: SubscriptionRepository;
  access: { staffSalonId(actor: Actor, requestedSalonId?: string): Promise<string> };
  events: EventPublisher;
  clock: Clock;
};

/**
 * Abonnements (ADM-05) : le gérant déclare son paiement (virement, D17, espèces) avec sa preuve,
 * le Super Admin l'accepte (le plan s'active pour 30 jours) ou le refuse (motif obligatoire). Chaque décision est journalisée.
 */
export function makeSubscription({ subscriptions, access, events, clock }: SubscriptionDeps) {
  async function open(salonId: string, requestedById: string, plan: PaidPlan, details: { channel: PlanPaymentChannel; reference: string | null; note: string | null }) {
    if (await subscriptions.hasPending(salonId)) throw conflict("PENDING_EXISTS", "Un paiement est déjà en attente de validation par l'équipe Glowy.");
    const payment = await subscriptions.create({ salonId, requestedById, plan, amount: PLAN_PRICES[plan], ...details });
    await events.publish("plan.paymentRequested", { paymentId: payment.id, salonId });
    return payment;
  }

  /** Le gérant déclare le paiement du plan Pro ou Premium pour son salon */
  async function requestPlan(actor: Actor, input: RequestPlanInput) {
    if (actor.role !== "MANAGER") throw forbidden("Seul le gérant du salon peut demander un plan.");
    const salonId = await access.staffSalonId(actor);
    const salon = await subscriptions.salon(salonId);
    if (!salon) throw notFound("Salon introuvable.");
    if (isAlreadyCovered(salon, input.plan, clock.now())) throw conflict("ALREADY_ACTIVE", "Ce plan est déjà actif. Le renouvellement est possible 7 jours avant l'échéance.");
    return open(salonId, actor.id, input.plan, { channel: input.channel, reference: input.reference, note: input.note ?? null });
  }

  /** À l'inscription d'un salon qui choisit un plan payant : demande en attente, sans preuve (à compléter par un paiement) */
  async function openForNewSalon(salonId: string, ownerId: string, plan: PaidPlan) {
    return open(salonId, ownerId, plan, { channel: "VIREMENT", reference: null, note: "Plan choisi à l'inscription" });
  }

  /** Le Super Admin accepte (plan actif 30 jours) ou refuse (motif obligatoire) un paiement */
  async function decide(actor: Actor, paymentId: string, input: DecidePaymentInput) {
    if (actor.role !== "ADMIN") throw forbidden();
    const payment = await subscriptions.findById(paymentId);
    if (!payment) throw notFound("Paiement introuvable.");
    if (payment.status !== "PENDING") throw conflict("ALREADY_DECIDED", "Ce paiement a déjà été traité.");

    const now = clock.now();
    const accepted = input.action === "accept";
    const salon = accepted ? await subscriptions.salon(payment.salonId) : null;
    const until = accepted ? paidUntil(now, salon && salon.plan === payment.plan ? salon.planUntil : null) : null;
    const updated = await subscriptions.decide(
      paymentId,
      { accepted, actorId: actor.id, reason: input.action === "refuse" ? input.reason : null, at: now, paidUntil: until },
      {
        actorId: actor.id,
        action: accepted ? "payment.accept" : "payment.refuse",
        targetType: "PlanPayment",
        targetId: paymentId,
        meta: { salonId: payment.salonId, plan: payment.plan, amount: payment.amount, reference: payment.reference },
      }
    );
    if (!updated) throw conflict("ALREADY_DECIDED", "Ce paiement a déjà été traité.");
    await events.publish("plan.paymentDecided", { paymentId, salonId: payment.salonId, accepted, actorId: actor.id });
    return updated;
  }

  return { requestPlan, openForNewSalon, decide };
}

export type Subscription = ReturnType<typeof makeSubscription>;
