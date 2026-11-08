import type { Metadata } from "next";
import { ClockCard, MonthPicker, MonthTable, MyPayslips, PayrollSettingsForm, PayslipsManager, TeamToday } from "@/components/manage/payroll";
import { ManageHeader } from "@/components/manage/kit";
import { tunisToday } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { requirePageUser } from "@/infrastructure/session";
import { staffSalon } from "@/modules/dashboard";
import { employeeMonth, employeeOfUser, managedEmployee, myPayslips, myToday, payrollRates, previousPeriod, salonPayslips, salonToday } from "@/modules/payroll";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.payroll.title };
}

/** Les 12 derniers mois, du plus récent au plus ancien (« 2026-11 », « 2026-10 »…) */
function lastMonths(today: string) {
  const months = [today.slice(0, 7)];
  while (months.length < 12) months.push(previousPeriod(months.at(-1)!));
  return months;
}

/**
 * Paie & pointage. Professionnel : pointage du jour, dossier du mois, fiches de paie validées.
 * Gérant : équipe du jour (corrections), fiches du mois (brouillons, validation), taux des retenues, dossier de chacun.
 */
export default async function PayrollPage({ searchParams }: PageProps<"/dashboard/paie">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { t, f } = await getI18n();
  const p = t.manage.payroll;
  const params = await searchParams;
  const today = tunisToday();
  const months = lastMonths(today);
  const asked = typeof params.mois === "string" && months.includes(params.mois) ? params.mois : null;

  if (user.role === "EMPLOYEE") {
    const employee = await employeeOfUser(user.id);
    const period = asked ?? months[0];
    const [now, month, slips] = await Promise.all([myToday(user.id), employeeMonth(String(employee._id), period), myPayslips(user.id)]);
    const current = period === months[0] ? month : await employeeMonth(String(employee._id), months[0]);
    const plannedToday = current.days.find((d) => d.date === today)?.plannedMinutes ?? 0;
    return (
      <div className="space-y-6">
        <ManageHeader title={p.myTitle} description={p.myDescription} />
        <ClockCard today={now} plannedMinutes={plannedToday} />
        <div className="flex justify-end">
          <MonthPicker period={period} months={months} />
        </div>
        <MonthTable month={month} />
        <MyPayslips slips={slips} />
      </div>
    );
  }

  // Gérant : par défaut le mois précédent pendant les 10 premiers jours (période de validation des fiches)
  const period = asked ?? (Number(today.slice(8)) <= 10 ? months[1] : months[0]);
  const salon = await staffSalon(user);
  const employeeId = typeof params.employe === "string" ? params.employe : null;
  const [team, slips, rates, dossier] = await Promise.all([
    salonToday(user),
    salonPayslips(user, period),
    payrollRates(salon.id),
    employeeId ? managedEmployee(user, employeeId).then((e) => employeeMonth(String(e._id), period)) : null,
  ]);
  return (
    <div className="space-y-6">
      <ManageHeader title={p.title} description={p.description} action={<MonthPicker period={period} months={months} />} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <TeamToday rows={team} />
        <PayrollSettingsForm rates={rates} />
      </div>
      <PayslipsManager period={period} slips={slips} />
      {dossier && (
        <div className="space-y-2" id="dossier">
          <h2 className="text-sm font-semibold text-muted-foreground">{f(p.dossierOf, { name: dossier.employee.name })}</h2>
          <MonthTable month={dossier} />
        </div>
      )}
    </div>
  );
}
