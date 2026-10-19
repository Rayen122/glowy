import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { TeamManager } from "@/components/manage/team-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listTeam, salonSettings, staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.team.title };
}

/** SAL-05 (professionnels, horaires, congés) et AUTH-07 (comptes des employés créés par le gérant) */
export default async function TeamPage() {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t }, team, settings] = await Promise.all([getI18n(), listTeam(salon.id), salonSettings(salon.id)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.team.title} description={t.manage.team.description} />
      <TeamManager team={team} openingHours={settings.openingHours} />
    </div>
  );
}
