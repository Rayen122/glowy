import type { Metadata } from "next";
import { BranchesManager } from "@/components/manage/branches-manager";
import { ManageHeader } from "@/components/manage/kit";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listBranches, staffSalon } from "@/modules/dashboard";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { planAccess } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.branches.title };
}

/** SAL-14 : succursales du gérant */
export default async function BranchesPage() {
  const user = await requirePageUser("MANAGER");
  const [{ t }, branches, access] = await Promise.all([getI18n(), listBranches(user), staffSalon(user).then((s) => planAccess(s.id))]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.branches.title} description={t.manage.branches.description} />
      {access.features.includes("branches") ? <BranchesManager branches={branches} /> : <PlanUpsell feature="branches" canUpgrade compact />}
    </div>
  );
}
