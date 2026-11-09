import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Boxes, Building2, CalendarDays, ChartColumn, ChevronsUpDown, CreditCard, Headset, Hourglass, LayoutGrid, ListOrdered, MessageSquareText, Percent, Plus, Receipt, Scissors, Settings, UserRound, Users, Wallet } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/app-shell/app-shell";
import { SessionMark } from "@/components/pwa/session-mark";
import { getI18n } from "@/i18n/server";
import { lowStockCount, staffSalon } from "@/modules/dashboard";
import { requirePageUser } from "@/infrastructure/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t.dashboard.metaTitle, template: `%s · ${t.dashboard.metaShort} · Glowy` } };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const [{ t, tc }, salon] = await Promise.all([getI18n(), staffSalon(user)]);
  const lowStock = user.role === "EMPLOYEE" ? 0 : await lowStockCount(salon.id);
  const d = t.dashboard;

  // Employé : seulement son espace (sa journée, son agenda, la file d'attente) — rien de la gestion du salon
  const employeeGroups: NavGroup[] = [
    {
      label: d.nav.mySpace,
      items: [
        { href: "/dashboard", label: d.nav.myDay, icon: <LayoutGrid />, exact: true },
        { href: "/dashboard/agenda", label: d.nav.myAgenda, icon: <CalendarDays /> },
        { href: "/dashboard/file-attente", label: t.manage.queue.title, icon: <ListOrdered /> },
        // Son pointage et ses fiches de paie (jamais celles de ses collègues)
        { href: "/dashboard/paie", label: t.manage.payroll.myTitle, icon: <Wallet /> },
      ],
    },
    { label: d.nav.help, items: [{ href: "/dashboard/support", label: t.manage.support.title, icon: <Headset /> }] },
  ];

  const managerGroups: NavGroup[] = [
    {
      label: d.nav.pilot,
      items: [
        { href: "/dashboard", label: d.nav.overview, icon: <LayoutGrid />, exact: true },
        { href: "/dashboard/agenda", label: d.nav.agenda, icon: <CalendarDays /> },
        { href: "/dashboard/file-attente", label: t.manage.queue.title, icon: <ListOrdered /> },
        { href: "/dashboard/statistiques", label: d.nav.statistics, icon: <ChartColumn /> },
      ],
    },
    {
      label: d.nav.salon,
      items: [
        { href: "/dashboard/services", label: d.nav.services, icon: <Scissors /> },
        { href: "/dashboard/equipe", label: d.nav.team, icon: <Users /> },
        // Paie & pointage : le professionnel y pointe et retrouve ses fiches de paie ; le gérant y valide celles de l'équipe
        { href: "/dashboard/paie", label: user.role === "EMPLOYEE" ? t.manage.payroll.myTitle : t.manage.payroll.title, icon: <Wallet /> },
        { href: "/dashboard/clients", label: d.nav.clients, icon: <UserRound /> },
        { href: "/dashboard/avis", label: d.nav.reviews, icon: <MessageSquareText />, badge: "1" },
        { href: "/dashboard/promotions", label: d.nav.promotions, icon: <Percent /> },
        { href: "/dashboard/caisse", label: d.nav.cashier, icon: <Receipt /> },
        { href: "/dashboard/stocks", label: d.nav.stocks, icon: <Boxes />, badge: lowStock > 0 ? String(lowStock) : undefined },
      ],
    },
    {
      label: d.nav.settings,
      items: [
        { href: "/dashboard/parametres", label: d.nav.settingsPage, icon: <Settings /> },
        { href: "/dashboard/support", label: t.manage.support.title, icon: <Headset /> },
        ...(user.role === "MANAGER"
          ? [
              { href: "/dashboard/abonnement", label: d.nav.subscription, icon: <CreditCard /> },
              { href: "/dashboard/succursales", label: t.manage.branches.title, icon: <Building2 /> },
            ]
          : []),
      ],
    },
  ];

  return (
    <AppShell
      space={d.space}
      helpHref="/dashboard/support"
      groups={user.role === "EMPLOYEE" ? employeeGroups : managerGroups}
      user={{ name: `${user.firstName} ${user.lastName}`.trim(), role: user.role === "EMPLOYEE" ? t.auth.form.roles.employee : user.role === "ADMIN" ? t.admin.metaTitle : d.managerRole }}
      context={
        // SAL-14 : le gérant change de succursale depuis la page « Succursales »
        user.role === "MANAGER" ? (
          <Link href="/dashboard/succursales" aria-label={t.manage.branches.title} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-start hover:bg-muted/60">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                {salon.coverUrl && <Image src={salon.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{salon.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {tc(salon.city)} · {t.admin.plans[salon.plan]}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        ) : (
          <div className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-start">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-muted">
                {salon.coverUrl && <Image src={salon.coverUrl} alt="" fill sizes="40px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{salon.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {tc(salon.city)} · {t.admin.plans[salon.plan]}
                </span>
              </span>
          </div>
        )
      }
      action={
        <Link
          href="/dashboard/agenda"
          aria-label={d.newBooking}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-plum-800 max-[420px]:w-11 max-[420px]:px-0 sm:px-4"
        >
          <Plus className="size-4" aria-hidden />
          {/* Très petits écrans : icône seule (le libellé reste lu par les lecteurs d'écran) */}
          <span className="max-[420px]:sr-only">{d.newBooking}</span>
        </Link>
      }
    >
      {salon.status === "PENDING" && (
        <p role="status" className="mb-5 flex items-start gap-2.5 rounded-2xl bg-sand p-3.5 text-sm font-medium text-plum-800 ring-1 ring-border">
          <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden />
          {d.pendingBanner}
        </p>
      )}
      <SessionMark userId={user.id} />
      {children}
    </AppShell>
  );
}
