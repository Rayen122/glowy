import type { PlanId, PlanPaymentChannel, PlanPaymentStatus } from "@/core/domain/enums";

export type PlanPaymentRecord = {
  id: string;
  salonId: string;
  plan: PlanId;
  amount: number;
  channel: PlanPaymentChannel;
  reference: string | null;
  note: string | null;
  status: PlanPaymentStatus;
  decidedAt: Date | null;
  reason: string | null;
  paidUntil: Date | null;
  createdAt: Date;
};

export type NewPlanPayment = {
  salonId: string;
  requestedById: string;
  plan: PlanId;
  amount: number;
  channel: PlanPaymentChannel;
  reference: string | null;
  note: string | null;
};

export type Decision = { accepted: boolean; actorId: string; reason: string | null; at: Date; paidUntil: Date | null };
export type Audit = { actorId: string; action: string; targetType: string; targetId: string; meta?: Record<string, unknown> };

export interface SubscriptionRepository {
  salon(salonId: string): Promise<{ id: string; name: string; plan: PlanId; planUntil: Date | null } | null>;
  hasPending(salonId: string): Promise<boolean>;
  create(data: NewPlanPayment): Promise<PlanPaymentRecord>;
  findById(id: string): Promise<PlanPaymentRecord | null>;
  /** Décision seulement si le paiement est encore en attente ; active le plan si accepté et journalise. null si déjà traité. */
  decide(id: string, decision: Decision, audit: Audit): Promise<PlanPaymentRecord | null>;
}
