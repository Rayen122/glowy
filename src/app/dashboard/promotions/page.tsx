import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { PromotionsManager, SalonRewardsManager } from "@/components/manage/promotions-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { staffSalon } from "@/modules/dashboard";
import { listSalonPromotions, listSalonRewards, salonPointsOverview } from "@/modules/promotions";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { planAccess } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.promos.title };
}

/** SAL-10 et FID-06 : promotions (gérant) ; récompenses et validation des codes (toute l'équipe) */
export default async function PromotionsPage() {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const salon = await staffSalon(user);
  const canEdit = user.role !== "EMPLOYEE";
  const promosAllowed = (await planAccess(salon.id)).features.includes("promotions");
  const [{ t }, promotions, rewards, points] = await Promise.all([getI18n(), canEdit && promosAllowed ? listSalonPromotions(salon.id) : [], listSalonRewards(salon.id), salonPointsOverview(salon.id)]);
  return (
    <div className="space-y-8">
      <ManageHeader title={t.manage.promos.title} description={t.manage.promos.description} />
      {canEdit && (promosAllowed ? <PromotionsManager promotions={promotions} /> : <PlanUpsell feature="promotions" canUpgrade compact />)}
      <SalonRewardsManager rewards={rewards} canEdit={canEdit} points={points} />
    </div>
  );
}
