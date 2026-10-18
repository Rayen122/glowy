import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  CalendarDays,
  ChartColumn,
  ChevronsUpDown,
  CreditCard,
  LayoutGrid,
  MessageSquareText,
  Percent,
  Plus,
  Receipt,
  Scissors,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { AppShell, type NavGroup } from "@/components/app-shell/app-shell";
import { getI18n } from "@/i18n/server";
import { staffSalon } from "@/modules/dashboard";
import { requirePageUser } from "@/infrastructure/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t.dashboard.metaTitle, template: `%s · ${t.dashboard.metaShort} · Glowy` } };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const [{ t, tc }, salon] = await Promise.all([getI18n(), staffSalon(user)]);
  const d = t.dashboard;

  const groups: NavGroup[] = [
    {
      label: d.nav.pilot,
      items: [
        { href: "/dashboard", label: d.nav.overview, icon: <LayoutGrid />, exact: true },
        { href: "/dashboard/agenda", label: d.nav.agenda, icon: <CalendarDays /> },
        { href: "/dashboard/statistiques", label: d.nav.statistics, icon: <ChartColumn /> },
      ],
    },
    {
      label: d.nav.salon,
      items: [
        { href: "/dashboard/services", label: d.nav.services, icon: <Scissors /> },
        { href: "/dashboard/equipe", label: d.nav.team, icon: <Users /> },
        { href: "/dashboard/clients", label: d.nav.clients, icon: <UserRound /> },
        { href: "/dashboard/avis", label: d.nav.reviews, icon: <MessageSquareText />, badge: "1" },
        { href: "/dashboard/promotions", label: d.nav.promotions, icon: <Percent /> },
        { href: "/dashboard/caisse", label: d.nav.cashier, icon: <Receipt /> },
        { href: "/dashboard/stocks", label: d.nav.stocks, icon: <Boxes /> },
      ],
    },
    {
      label: d.nav.settings,
      items: [
        { href: "/dashboard/parametres", label: d.nav.settingsPage, icon: <Settings /> },
        ...(user.role === "MANAGER" ? [{ href: "/dashboard/abonnement", label: d.nav.subscription, icon: <CreditCard /> }] : []),
      ],
    },
  ];

  return (
    <AppShell
      space={d.space}
      groups={groups}
      user={{ name: `${user.firstName} ${user.lastName}`.trim(), role: user.role === "EMPLOYEE" ? t.auth.form.roles.employee : user.role === "ADMIN" ? t.admin.metaTitle : d.managerRole }}
      context={
        <button type="button" className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-start hover:bg-muted/60">
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
        </button>
      }
      action={
        <Link
          href="/dashboard/agenda"
          aria-label={d.newBooking}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-plum-800 sm:px-4"
        >
          <Plus className="size-4" aria-hidden />
          <span>{d.newBooking}</span>
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
