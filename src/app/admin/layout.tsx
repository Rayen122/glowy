import type { Metadata } from "next";
import { ChartColumn, CreditCard, Gift, LayoutGrid, Mail, ScrollText, Settings, ShieldAlert, Store, Users } from "lucide-react";
import { AppShell, type NavGroup } from "@/components/app-shell/app-shell";
import { getI18n } from "@/i18n/server";
import { requirePageUser } from "@/infrastructure/session";
import { adminCounts } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t.admin.metaTitle, template: `%s · ${t.admin.metaTitle} · Glowy` } };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("ADMIN");
  const [{ t }, counts] = await Promise.all([getI18n(), adminCounts()]);
  const badge = (n: number) => (n > 0 ? String(n) : undefined);
  const a = t.admin;
  const m = t.modules.admin;

  const groups: NavGroup[] = [
    {
      items: [{ href: "/admin", label: a.nav.overview, icon: <LayoutGrid />, exact: true }],
    },
    {
      label: a.nav.platform,
      items: [
        { href: "/admin/salons", label: m.salons.title, icon: <Store />, badge: badge(counts.pendingSalons) },
        { href: "/admin/utilisateurs", label: m.utilisateurs.title, icon: <Users /> },
        { href: "/admin/moderation", label: m.moderation.title, icon: <ShieldAlert />, badge: badge(counts.openReports) },
      ],
    },
    {
      label: a.nav.business,
      items: [
        { href: "/admin/abonnements", label: m.abonnements.title, icon: <CreditCard />, badge: badge(counts.pendingPayments) },
        { href: "/admin/fidelite", label: m.fidelite.title, icon: <Gift /> },
        { href: "/admin/rapports", label: m.rapports.title, icon: <ChartColumn /> },
      ],
    },
    {
      label: a.nav.system,
      items: [
        { href: "/admin/audit", label: m.audit.title, icon: <ScrollText /> },
        { href: "/admin/messages", label: t.manage.admin.outboxTitle, icon: <Mail /> },
        { href: "/admin/parametres", label: a.nav.settings, icon: <Settings /> },
      ],
    },
  ];

  return (
    <AppShell
      space={a.space}
      groups={groups}
      user={{ name: a.userName, role: a.metaTitle }}
      context={
        <div className="rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs text-white/60">{a.envLabel}</p>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold">
            <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden /> {a.envValue}
          </p>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
