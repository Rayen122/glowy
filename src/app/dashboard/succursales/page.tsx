import type { Metadata } from "next";
import { BranchesManager } from "@/components/manage/branches-manager";
import { ManageHeader } from "@/components/manage/kit";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listBranches } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.branches.title };
}

/** SAL-14 : succursales du gérant */
export default async function BranchesPage() {
  const user = await requirePageUser("MANAGER");
  const [{ t }, branches] = await Promise.all([getI18n(), listBranches(user)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.branches.title} description={t.manage.branches.description} />
      <BranchesManager branches={branches} />
    </div>
  );
}
