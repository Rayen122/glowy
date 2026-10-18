import { AuditLog, idOf, objectId, PlanPayment, Salon, withTransaction, type PlanPaymentDoc } from "@/infrastructure/db";
import type { PlanPaymentRecord, SubscriptionRepository } from "../application/ports";

export const toRecord = (p: PlanPaymentDoc): PlanPaymentRecord => ({
  id: idOf(p),
  salonId: p.salon.toString(),
  plan: p.plan,
  amount: p.amount,
  channel: p.channel,
  reference: p.reference ?? null,
  note: p.note ?? null,
  status: p.status,
  decidedAt: p.decidedAt ?? null,
  reason: p.reason ?? null,
  paidUntil: p.paidUntil ?? null,
  createdAt: p.createdAt,
});

export const mongoSubscriptionRepository: SubscriptionRepository = {
  async salon(salonId) {
    const _id = objectId(salonId);
    const salon = _id ? await Salon.findById(_id, { name: 1, plan: 1, planUntil: 1 }).lean() : null;
    return salon ? { id: idOf(salon), name: salon.name, plan: salon.plan, planUntil: salon.planUntil ?? null } : null;
  },

  hasPending: async (salonId) => (await PlanPayment.exists({ salon: objectId(salonId), status: "PENDING" })) !== null,

  async create(data) {
    const payment = await PlanPayment.create({
      salon: objectId(data.salonId)!,
      requestedBy: objectId(data.requestedById)!,
      plan: data.plan,
      amount: data.amount,
      channel: data.channel,
      reference: data.reference,
      note: data.note,
    });
    return toRecord(payment.toObject());
  },

  async findById(id) {
    const _id = objectId(id);
    const payment = _id ? await PlanPayment.findById(_id).lean() : null;
    return payment ? toRecord(payment) : null;
  },

  decide: (id, { accepted, actorId, reason, at, paidUntil }, audit) =>
    withTransaction(async (session) => {
      // Mise à jour conditionnelle : deux décisions simultanées → une seule passe
      const updated = await PlanPayment.findOneAndUpdate(
        { _id: objectId(id), status: "PENDING" },
        { $set: { status: accepted ? "ACCEPTED" : "REFUSED", decidedBy: objectId(actorId), decidedAt: at, reason, paidUntil } },
        { session, returnDocument: "after" }
      ).lean();
      if (!updated) return null;
      if (accepted) await Salon.updateOne({ _id: updated.salon }, { $set: { plan: updated.plan, planUntil: paidUntil } }, { session });
      await AuditLog.create([{ actor: objectId(audit.actorId), action: audit.action, targetType: audit.targetType, targetId: audit.targetId, meta: audit.meta ?? null }], { session });
      return toRecord(updated);
    }),
};
