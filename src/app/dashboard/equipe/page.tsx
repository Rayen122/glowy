import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { TeamManager } from "@/components/manage/team-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { listTeam, salonSettings, staffSalon } from "@/modules/dashboard";
import Link from "next/link";
import { planAccess } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.team.title };
}

/** SAL-05 (professionnels, horaires, congés) et AUTH-07 (comptes des employés créés par le gérant) */
export default async function TeamPage() {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t, f }, team, settings, access] = await Promise.all([getI18n(), listTeam(salon.id), salonSettings(salon.id), planAccess(salon.id)]);
  const atLimit = access.maxEmployees !== null && team.filter((m) => m.active).length >= access.maxEmployees;
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.team.title} description={t.manage.team.description} />
      {atLimit && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-blush/50 p-4 text-sm ring-1 ring-plum-200/60">
          {f(t.dashboard.planGate.employees, { plan: t.admin.plans[access.plan], max: access.maxEmployees ?? 0 })}
          <Link href="/dashboard/abonnement" className="font-semibold text-plum-700 hover:underline">
            {t.dashboard.planGate.seePlans}
          </Link>
        </p>
      )}
      <TeamManager team={team} openingHours={settings.openingHours} />
    </div>
  );
}
