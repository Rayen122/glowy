import { cache } from "react";
import { AuditLog, Booking, objectId, PlatformSetting, Salon } from "@/infrastructure/db";
import type { PlanId } from "@/core/domain/enums";
import type { PlatformSettingsInput } from "../application/schemas";
import { commissionOn, DEFAULT_SETTINGS, type PlatformSettingsView } from "../domain/defaults";

const ID = "platform";

/**
 * Lu une fois par requête (React cache) : jamais de copie en mémoire entre requêtes, pour qu'un réglage
 * du Super Admin s'applique aussitôt sur toutes les instances du serveur.
 */
export const getPlatformSettings = cache(async (): Promise<PlatformSettingsView> => {
  const doc = await PlatformSetting.findById(ID).lean();
  const value: PlatformSettingsView = {
    cities: doc?.cities?.length ? doc.cities.map((c) => ({ name: c.name ?? "", active: c.active ?? true })) : DEFAULT_SETTINGS.cities,
    categories: DEFAULT_SETTINGS.categories.map((d) => ({ id: d.id, active: doc?.categories?.find((c) => c.id === d.id)?.active ?? true })),
    serviceGroups: doc?.serviceGroups?.length ? doc.serviceGroups : DEFAULT_SETTINGS.serviceGroups,
    locales: doc?.locales?.length ? (doc.locales as PlatformSettingsView["locales"]) : DEFAULT_SETTINGS.locales,
    commissions: { ...DEFAULT_SETTINGS.commissions, ...(doc?.commissions ?? {}) } as Record<PlanId, number>,
  };
  return value;
});

export async function updatePlatformSettings(actorId: string, input: PlatformSettingsInput) {
  await PlatformSetting.updateOne({ _id: ID }, { $set: input }, { upsert: true });
  await AuditLog.create({ actor: objectId(actorId), action: "platform.settings", targetType: "Platform", targetId: null, meta: { name: Object.keys(input).join(", ") } });
  return getPlatformSettings();
}

/** Villes actives avec le nombre réel de salons en ligne (page d'accueil, pied de page) */
export async function activeCities() {
  const [settings, counts] = await Promise.all([getPlatformSettings(), Salon.aggregate<{ _id: string; n: number }>([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$city", n: { $sum: 1 } } }])]);
  return settings.cities.filter((c) => c.active).map((c) => ({ name: c.name, salons: counts.find((x) => x._id === c.name)?.n ?? 0 }));
}

/** ADM-05 : commissions Glowy sur les acomptes payés en ligne, par salon, sur la période */
export async function commissionsReport(days = 30, now = new Date()) {
  const settings = await getPlatformSettings();
  const since = new Date(now.getTime() - days * 86_400_000);
  const rows = await Booking.aggregate<{ _id: unknown; deposits: number; bookings: number }>([
    { $match: { createdAt: { $gte: since, $lte: now }, "payment.status": "PAID" } },
    { $group: { _id: "$salon", deposits: { $sum: "$payment.amount" }, bookings: { $sum: 1 } } },
  ]);
  const salons = await Salon.find({ _id: { $in: rows.map((r) => r._id) } }, { name: 1, plan: 1, city: 1 }).lean();
  const list = rows
    .map((r) => {
      const salon = salons.find((s) => String(s._id) === String(r._id));
      const plan = (salon?.plan ?? "gratuit") as PlanId;
      const rate = settings.commissions[plan];
      return { salon: salon?.name ?? "", city: salon?.city ?? "", plan, rate, bookings: r.bookings, deposits: r.deposits, commission: commissionOn(r.deposits, rate) };
    })
    .sort((a, b) => b.commission - a.commission);
  return { days, rates: settings.commissions, total: Math.round(list.reduce((a, r) => a + r.commission, 0) * 1000) / 1000, deposits: list.reduce((a, r) => a + r.deposits, 0), rows: list };
}

export type CommissionsReport = Awaited<ReturnType<typeof commissionsReport>>;
