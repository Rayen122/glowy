import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { SettingsManager } from "@/components/manage/settings-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { salonSettings, staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.settings.title };
}

/** SAL-02 (profil, photos, portfolio avant/après) et SAL-07 (horaires, annulation, acompte) */
export default async function SettingsPage() {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t }, settings] = await Promise.all([getI18n(), salonSettings(salon.id)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.settings.title} description={t.manage.settings.description} />
      <SettingsManager settings={settings} />
    </div>
  );
}
