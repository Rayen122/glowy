import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileText, Search, Star } from "lucide-react";
import { Pager, SalonActions } from "@/components/manage/admin-actions";
import { ManageHeader } from "@/components/manage/kit";
import { utcToTunis } from "@/core/domain/time";
import { SALON_STATUSES, type SalonStatus } from "@/core/domain/enums";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { listSalonsForAdmin } from "@/modules/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.salonsTitle };
}

const STATUS_STYLE: Record<SalonStatus, string> = {
  PENDING: "bg-sand text-plum-800",
  ACTIVE: "bg-success-soft text-success",
  SUSPENDED: "bg-danger-soft text-destructive",
  REJECTED: "bg-muted text-muted-foreground",
};
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ADM-02 / ADM-03 : tous les salons, filtres, actions et accès au dashboard */
export default async function AdminSalonsPage({ searchParams }: PageProps<"/admin/salons">) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const statusParam = one(sp.statut);
  const status = (SALON_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as SalonStatus) : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ t, nf, df, tc }, list] = await Promise.all([getI18n(), listSalonsForAdmin({ q, status, page })]);
  const m = t.manage.admin;
  const total = Object.values(list.counts).reduce((a, n) => a + (n ?? 0), 0);
  const tab = (value?: SalonStatus) => `?${new URLSearchParams(Object.entries({ q, statut: value }).filter((e): e is [string, string] => Boolean(e[1]))).toString()}`;

  return (
    <div className="space-y-5">
      <ManageHeader title={m.salonsTitle} description={m.salonsDescription} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label={m.colStatus}>
          {[undefined, ...SALON_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={tab(s)}
              aria-current={s === status ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1", s === status ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
            >
              {s ? m.statuses[s] : t.manage.common.all}
              <span className="tabular-nums opacity-70">{nf(s ? (list.counts[s] ?? 0) : total)}</span>
            </Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-72" role="search">
          {status && <input type="hidden" name="statut" value={status} />}
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={q} placeholder={m.searchPlaceholder} aria-label={t.manage.common.search} className="h-10 w-full rounded-full border border-border bg-card ps-9 pe-4 text-base sm:text-sm" />
        </form>
      </div>

      <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {[m.colSalon, m.colOwner, m.colPlan, m.colStatus, m.colActivity, m.colRating, m.colCreated, t.manage.common.actions].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  {m.noSalons}
                </td>
              </tr>
            )}
            {list.rows.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="flex items-center gap-1.5 font-semibold">
                    {s.name}
                    {s.verified && <BadgeCheck className="size-4 text-plum-600" aria-label={m.verifiedBadge} />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tc(s.city)} · {t.categories[s.category as keyof typeof t.categories] ?? s.category}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {s.status === "ACTIVE" && (
                      <Link href={`/salons/${s.slug}`} className="inline-flex items-center gap-1 font-semibold text-plum-700 hover:underline">
                        <ExternalLink className="size-3" aria-hidden /> {m.publicPage}
                      </Link>
                    )}
                    {s.documentUrl && (s.documentUrl.startsWith("/api/media/") ? (
                      <a href={s.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-plum-700 hover:underline">
                        <FileText className="size-3" aria-hidden /> {m.document}
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FileText className="size-3" aria-hidden /> {s.documentUrl}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p>{s.owner?.name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.owner?.email}</p>
                </td>
                <td className="px-4 py-3">{t.admin.plans[s.plan as keyof typeof t.admin.plans] ?? s.plan}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", STATUS_STYLE[s.status as SalonStatus])}>{m.statuses[s.status as SalonStatus]}</span>
                </td>
                <td className="px-4 py-3 tabular-nums">{nf(s.bookings30d)}</td>
                <td className="px-4 py-3 tabular-nums">
                  {s.reviewCount ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-star text-star" aria-hidden /> {nf(s.rating)} ({nf(s.reviewCount)})
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{df(utcToTunis(s.createdAt).date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-4 py-3">
                  <SalonActions id={s.id} name={s.name} status={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} params={{ q, statut: status }} />
    </div>
  );
}
