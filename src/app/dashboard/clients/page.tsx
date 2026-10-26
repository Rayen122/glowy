import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Pager } from "@/components/manage/admin-actions";
import { ManageHeader } from "@/components/manage/kit";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { CRM_FILTERS, listSalonClients, staffSalon, type CrmFilter } from "@/modules/dashboard";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { planAccess } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.crm.title };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** SAL-08 : clientes du salon */
export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 60);
  const asked = one(sp.filtre);
  const filter: CrmFilter = (CRM_FILTERS as readonly string[]).includes(asked ?? "") ? (asked as CrmFilter) : "all";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const salon = await staffSalon(user);
  // Fonction réservée à un plan supérieur : présentation du plan à la place de la page
  if (!(await planAccess(salon.id)).features.includes("crm")) return <PlanUpsell feature="crm" canUpgrade={user.role !== "EMPLOYEE"} />;
  const [{ t, f, nf, money, df }, list] = await Promise.all([getI18n(), listSalonClients(salon.id, { q, filter, page })]);
  const m = t.manage.crm;
  return (
    <div className="space-y-5">
      <ManageHeader title={m.title} description={m.description} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label={m.title}>
          {CRM_FILTERS.map((key) => (
            <Link
              key={key}
              href={`?${new URLSearchParams(Object.entries({ q, filtre: key === "all" ? undefined : key }).filter((e): e is [string, string] => Boolean(e[1]))).toString()}`}
              aria-current={key === filter ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1", key === filter ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
            >
              {m.filters[key]} <span className="tabular-nums opacity-70">{nf(list.counts[key])}</span>
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          {filter !== "all" && <input type="hidden" name="filtre" value={filter} />}
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={q} placeholder={t.manage.admin.searchPlaceholder} aria-label={t.manage.common.search} className="h-10 w-full rounded-full border border-border bg-card ps-9 pe-4 text-base sm:text-sm" />
        </form>
      </div>
      <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {[m.colClient, m.colVisits, m.colSpent, m.colLast].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  {m.empty}
                </td>
              </tr>
            )}
            {list.rows.map((c) => (
              <tr key={c.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/clients/${c.id}`} className="font-semibold hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {c.phone ?? c.email}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {c.inactive && <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-plum-800">{m.inactiveBadge}</span>}
                    {c.upcoming > 0 && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{f(m.upcoming, { n: c.upcoming })}</span>}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{nf(c.visits)}</td>
                <td className="px-4 py-3 font-semibold tabular-nums">{money(c.spent)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{c.lastVisit ? df(c.lastVisit, { day: "numeric", month: "short", year: "numeric" }) : m.never}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} params={{ q, filtre: filter === "all" ? undefined : filter }} />
    </div>
  );
}
