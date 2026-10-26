import { AuditLog, Salon } from "@/infrastructure/db";
import { notify, planExpired, planExpiring } from "@/modules/notifications";
import { PLAN_REMINDER_DAYS } from "../domain/plans";

const DAY_MS = 86_400_000;

/** Rappel au gérant quelques jours avant la fin d'un plan payant (une seule fois par échéance) */
export async function remindExpiringPlans(now = new Date()) {
  const limit = new Date(now.getTime() + PLAN_REMINDER_DAYS * DAY_MS);
  const salons = await Salon.find({ plan: { $ne: "gratuit" }, planUntil: { $gt: now, $lte: limit } }, { owner: 1, plan: 1, planUntil: 1, planReminderFor: 1 }).lean();
  let sent = 0;
  for (const salon of salons) {
    if (salon.planReminderFor?.getTime() === salon.planUntil!.getTime()) continue;
    // Mise à jour conditionnelle : deux passages simultanés n'envoient pas deux rappels
    const claimed = await Salon.updateOne({ _id: salon._id, planUntil: salon.planUntil, planReminderFor: { $ne: salon.planUntil } }, { $set: { planReminderFor: salon.planUntil } });
    if (!claimed.modifiedCount) continue;
    await notify(salon.owner.toString(), planExpiring(salon.plan, salon.planUntil!));
    sent++;
  }
  return sent;
}

/** Fin de période : le salon repasse au plan Gratuit (les fonctions Pro / Premium sont déjà bloquées dès l'échéance) */
export async function expirePlans(now = new Date()) {
  const salons = await Salon.find({ plan: { $ne: "gratuit" }, $or: [{ planUntil: null }, { planUntil: { $lte: now } }] }, { owner: 1, plan: 1, planUntil: 1 }).lean();
  let expired = 0;
  for (const salon of salons) {
    const updated = await Salon.updateOne({ _id: salon._id, plan: salon.plan }, { $set: { plan: "gratuit", planUntil: null, planReminderFor: null } });
    if (!updated.modifiedCount) continue;
    await AuditLog.create({ actor: null, action: "plan.expired", targetType: "Salon", targetId: salon._id.toString(), meta: { plan: salon.plan, until: salon.planUntil } });
    await notify(salon.owner.toString(), planExpired(salon.plan));
    expired++;
  }
  return expired;
}
