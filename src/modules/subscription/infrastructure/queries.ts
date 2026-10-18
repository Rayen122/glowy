import { PLAN_PRICES, type PlanId } from "@/core/domain/enums";
import { idOf, objectId, PlanPayment, ReviewReport, Salon, User, type PlanPaymentDoc } from "@/infrastructure/db";
import { daysLeft } from "../domain/rules";
import { toRecord } from "./mongo-subscription-repository";

/** Lectures pour l'interface (pas de règle métier) */

/** Abonnement d'un salon : plan en cours, échéance, demande en attente et historique (page « Abonnement » du gérant) */
export async function salonSubscription(salonId: string, now = new Date()) {
  const salon = await Salon.findById(objectId(salonId), { plan: 1, planUntil: 1 }).orFail().lean();
  const payments = (await PlanPayment.find({ salon: salon._id }).sort({ createdAt: -1 }).limit(10).lean()).map(toRecord);
  return {
    nowMs: now.getTime(),
    plan: salon.plan as PlanId,
    planUntil: salon.planUntil ?? null,
    daysLeft: daysLeft(salon.planUntil ?? null, now),
    pending: payments.find((p) => p.status === "PENDING") ?? null,
    payments,
  };
}

async function withSalons(payments: PlanPaymentDoc[]) {
  const salons = await Salon.find({ _id: { $in: payments.map((p) => p.salon) } }, { name: 1, city: 1, owner: 1 }).lean();
  const owners = await User.find({ _id: { $in: salons.map((s) => s.owner) } }, { firstName: 1, lastName: 1, email: 1 }).lean();
  const salonById = new Map(salons.map((s) => [idOf(s), s]));
  const ownerById = new Map(owners.map((o) => [idOf(o), o]));
  return payments.map((p) => {
    const salon = salonById.get(p.salon.toString());
    const owner = salon ? ownerById.get(salon.owner.toString()) : undefined;
    return { ...toRecord(p), salon: { name: salon?.name ?? "", city: salon?.city ?? "" }, owner: { name: `${owner?.firstName ?? ""} ${owner?.lastName ?? ""}`.trim(), email: owner?.email ?? "" } };
  });
}

/** Page « Abonnements » du Super Admin : paiements à valider, historique, revenus et répartition des plans actifs (ADM-05) */
export async function adminSubscriptions(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [pending, history, revenue, active] = await Promise.all([
    PlanPayment.find({ status: "PENDING" }).sort({ createdAt: 1 }).lean<PlanPaymentDoc[]>(),
    PlanPayment.find({ status: { $ne: "PENDING" } }).sort({ decidedAt: -1 }).limit(15).lean<PlanPaymentDoc[]>(),
    PlanPayment.aggregate<{ total: number }>([{ $match: { status: "ACCEPTED", decidedAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Salon.aggregate<{ _id: PlanId; count: number }>([{ $match: { status: "ACTIVE", plan: { $ne: "gratuit" }, planUntil: { $gt: now } } }, { $group: { _id: "$plan", count: { $sum: 1 } } }]),
  ]);
  const countOf = (plan: PlanId) => active.find((a) => a._id === plan)?.count ?? 0;
  return {
    nowMs: now.getTime(),
    pending: await withSalons(pending),
    history: await withSalons(history),
    revenue30d: revenue[0]?.total ?? 0,
    activePlans: { pro: countOf("pro"), premium: countOf("premium") },
    monthlyRecurring: countOf("pro") * PLAN_PRICES.pro + countOf("premium") * PLAN_PRICES.premium,
  };
}

export type AdminPaymentRow = Awaited<ReturnType<typeof adminSubscriptions>>["pending"][number];

/** Compteurs réels des pastilles du menu Super Admin */
export async function adminCounts() {
  const [pendingSalons, openReports, pendingPayments] = await Promise.all([
    Salon.countDocuments({ status: "PENDING" }),
    ReviewReport.countDocuments({ status: "OPEN" }),
    PlanPayment.countDocuments({ status: "PENDING" }),
  ]);
  return { pendingSalons, openReports, pendingPayments };
}

/** Revenus d'abonnements acceptés sur 30 jours (vue globale) */
export async function planRevenue(since: Date) {
  const [row] = await PlanPayment.aggregate<{ total: number }>([{ $match: { status: "ACCEPTED", decidedAt: { $gte: since } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
  return row?.total ?? 0;
}
