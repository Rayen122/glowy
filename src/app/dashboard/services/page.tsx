import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { ServicesManager } from "@/components/manage/services-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listSalonServices, staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.services.title };
}

/** SAL-03 : prestations, prix, durées, catégories et forfaits */
export default async function ServicesPage() {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t }, services] = await Promise.all([getI18n(), listSalonServices(salon.id)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.services.title} description={t.manage.services.description} />
      <ServicesManager services={services} />
    </div>
  );
}
