import { PAID_PLANS, type PaidPlan } from "@/core/domain/enums";
import type { EventSubscriber } from "@/core/domain/events";
import type { Subscription } from "./use-cases";

/** Un salon qui s'inscrit avec un plan payant : demande de paiement créée, en attente de validation par le Super Admin */
export function registerSubscriptionSubscribers(bus: EventSubscriber, { subscription }: { subscription: Subscription }) {
  bus.on("salon.registered", async ({ salonId, ownerId, plan }) => {
    if ((PAID_PLANS as readonly string[]).includes(plan)) await subscription.openForNewSalon(salonId, ownerId, plan as PaidPlan);
  });
}
