import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { StocksManager } from "@/components/manage/stocks-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listProducts, staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.stocks.title };
}

/** SAL-12 : stocks du salon ; l'équipe enregistre les mouvements, le gérant gère les fiches produit */
export default async function StocksPage() {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t }, data] = await Promise.all([getI18n(), listProducts(salon.id)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.stocks.title} description={t.manage.stocks.description} />
      <StocksManager data={data} canEdit={user.role !== "EMPLOYEE"} />
    </div>
  );
}
