import type { PointReason } from "@/core/domain/enums";
import { notFound } from "@/core/domain/errors";
import { addDays, tunisDayRange, utcToTunis } from "@/core/domain/time";
import { AuditLog, idOf, objectId, PointCampaign, PointRule, PointTransaction, User } from "@/infrastructure/db";
import type { PointCampaignInput, PointRuleInput } from "../application/admin-schemas";
import { DEFAULT_DAILY_CAP, DEFAULT_RULES } from "../domain/rules";

/** ADM-09 : barème de fidélité et campagnes « double points », réglés par le Super Admin */

/** Actions réglables (les mouvements techniques — échange, expiration, ajustement — ne le sont pas) */
export const EDITABLE_REASONS = (Object.keys(DEFAULT_RULES) as PointReason[]).filter((r) => !["REDEMPTION", "EXPIRATION", "ADJUSTMENT"].includes(r));

const audit = (actorId: string, action: string, targetType: string, targetId: string | null, meta: Record<string, unknown>) =>
  AuditLog.create({ actor: objectId(actorId), action, targetType, targetId, meta });

export async function listPointRules() {
  const saved = await PointRule.find({ reason: { $in: EDITABLE_REASONS } }).lean();
  return EDITABLE_REASONS.map((reason) => {
    const row = saved.find((r) => r.reason === reason);
    return {
      reason,
      points: row?.points ?? DEFAULT_RULES[reason].points,
      active: row?.active ?? true,
      monthlyCap: row ? (row.monthlyCap ?? null) : (DEFAULT_RULES[reason].monthlyCap ?? null),
      dailyCap: row?.dailyCap ?? null,
      defaultDailyCap: DEFAULT_DAILY_CAP,
    };
  });
}

export type PointRuleRow = Awaited<ReturnType<typeof listPointRules>>[number];

export async function updatePointRule(actorId: string, reason: PointReason, input: PointRuleInput) {
  if (!EDITABLE_REASONS.includes(reason)) throw notFound("Règle introuvable.");
  await PointRule.updateOne({ reason }, { $set: input }, { upsert: true });
  await audit(actorId, "loyalty.rule", "PointRule", reason, { name: reason, points: input.points, active: input.active });
  return { reason, ...input };
}

const campaignStatus = (c: { active: boolean; startsAt: Date; endsAt: Date }, now: Date) =>
  !c.active ? "off" : now < c.startsAt ? "scheduled" : now >= c.endsAt ? "ended" : "running";

export async function listCampaigns(now = new Date()) {
  return (await PointCampaign.find().sort({ startsAt: -1 }).limit(50).lean()).map((c) => ({
    id: idOf(c),
    label: c.label,
    multiplier: c.multiplier,
    startsOn: utcToTunis(c.startsAt).date,
    endsOn: addDays(utcToTunis(c.endsAt).date, -1),
    reasons: c.reasons as PointReason[],
    active: c.active,
    status: campaignStatus(c, now) as "off" | "scheduled" | "running" | "ended",
  }));
}

export type CampaignRow = Awaited<ReturnType<typeof listCampaigns>>[number];

/** Campagne en cours, affichée aux clientes (page fidélité) */
export async function runningCampaign(now = new Date()) {
  const c = await PointCampaign.findOne({ active: true, startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ multiplier: -1 }).lean();
  return c ? { label: c.label, multiplier: c.multiplier, endsOn: addDays(utcToTunis(c.endsAt).date, -1), reasons: c.reasons as PointReason[] } : null;
}

const period = (input: PointCampaignInput) => ({ startsAt: tunisDayRange(input.startsOn).start, endsAt: tunisDayRange(input.endsOn).end });

export async function createCampaign(actorId: string, input: PointCampaignInput) {
  const campaign = await PointCampaign.create({ label: input.label, multiplier: input.multiplier, reasons: input.reasons, active: input.active, ...period(input), createdBy: objectId(actorId) });
  await audit(actorId, "loyalty.campaign", "PointCampaign", idOf(campaign), { name: input.label, multiplier: input.multiplier });
  return { id: idOf(campaign) };
}

export async function setCampaignActive(actorId: string, id: string, active: boolean) {
  const updated = await PointCampaign.findOneAndUpdate({ _id: objectId(id) }, { $set: { active } }, { returnDocument: "after" }).lean();
  if (!updated) throw notFound("Campagne introuvable.");
  await audit(actorId, active ? "loyalty.campaign" : "loyalty.campaignOff", "PointCampaign", id, { name: updated.label, multiplier: updated.multiplier });
  return { id, active };
}

export async function deleteCampaign(actorId: string, id: string) {
  const removed = await PointCampaign.findOneAndDelete({ _id: objectId(id) }).lean();
  if (!removed) throw notFound("Campagne introuvable.");
  await audit(actorId, "loyalty.campaignOff", "PointCampaign", id, { name: removed.label, multiplier: removed.multiplier });
  return { id };
}

/** Chiffres des 30 derniers jours : points distribués, échangés, expirés, clientes avec un solde */
export async function loyaltyStats(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [byReason, members] = await Promise.all([
    PointTransaction.aggregate<{ _id: string; total: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: "$reason", total: { $sum: "$points" } } }]),
    User.countDocuments({ "loyalty.balance": { $gt: 0 } }),
  ]);
  const sum = (filter: (reason: string, total: number) => boolean) => byReason.filter((r) => filter(r._id, r.total)).reduce((a, r) => a + r.total, 0);
  return {
    earned: sum((reason, total) => total > 0 && reason !== "ADJUSTMENT"),
    redeemed: Math.abs(sum((reason) => reason === "REDEMPTION")),
    expired: Math.abs(sum((reason) => reason === "EXPIRATION")),
    members,
  };
}
