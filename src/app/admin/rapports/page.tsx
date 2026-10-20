import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { ManageHeader, PrintButton } from "@/components/manage/kit";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { platformReports, REPORT_PERIODS, type ReportKind, type ReportPeriod } from "@/modules/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.reports.title };
}

const TH = "px-4 py-2.5 text-start font-medium whitespace-nowrap";
const TD = "px-4 py-2.5 tabular-nums whitespace-nowrap";

/** ADM-08 : rapports par ville, par prestation et par salon ; export Excel (CSV) et impression PDF */
export default async function ReportsPage({ searchParams }: PageProps<"/admin/rapports">) {
  const asked = Number((await searchParams).jours);
  const days: ReportPeriod = (REPORT_PERIODS as readonly number[]).includes(asked) ? (asked as ReportPeriod) : 30;
  const [{ t, tc, nf, money }, r] = await Promise.all([getI18n(), platformReports(days)]);
  const m = t.manage.reports;
  const pct = (n: number) => `${nf(n)} %`;
  const exportLink = (kind: ReportKind) => (
    <a href={`/api/admin/reports/export?type=${kind}&days=${days}`} download className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-xs font-semibold hover:bg-muted print:hidden">
      <Download className="size-3.5" aria-hidden /> {t.manage.common.exportCsv}
    </a>
  );

  return (
    <div className="space-y-6">
      <ManageHeader title={m.title} description={m.description} action={<PrintButton label={t.manage.common.print} />} />
      <nav aria-label={m.title} className="flex flex-wrap gap-2 print:hidden">
        {REPORT_PERIODS.map((p) => (
          <Link
            key={p}
            href={`?jours=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1", p === days ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
          >
            {m.periods[String(p) as keyof typeof m.periods]}
          </Link>
        ))}
      </nav>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          [m.bookings, nf(r.totals.bookings)],
          [m.completed, nf(r.totals.completed)],
          [m.revenue, money(r.totals.revenue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-card p-4 ring-1 ring-border">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <ReportSection id="by-city" title={m.byCity} action={exportLink("city")}>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {[m.colCity, m.colSalons, m.bookings, m.revenue, m.colBasket, m.colCancel, m.colNoShow, m.colRating].map((h) => (
              <th key={h} scope="col" className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {r.cities.map((c) => (
            <tr key={c.city}>
              <th scope="row" className="px-4 py-2.5 text-start font-semibold">
                {tc(c.city)}
              </th>
              <td className={TD}>{nf(c.salons)}</td>
              <td className={TD}>{nf(c.bookings)}</td>
              <td className={cn(TD, "font-semibold")}>{money(c.revenue)}</td>
              <td className={TD}>{money(c.avgBasket)}</td>
              <td className={TD}>{pct(c.cancelRate)}</td>
              <td className={TD}>{pct(c.noShowRate)}</td>
              <td className={TD}>{c.rating ? nf(c.rating) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </ReportSection>

      <ReportSection id="by-service" title={m.byService} action={exportLink("service")}>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {[m.colService, m.bookings, m.revenue].map((h) => (
              <th key={h} scope="col" className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {r.services.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                {m.empty}
              </td>
            </tr>
          )}
          {r.services.map((s) => (
            <tr key={s.service}>
              <th scope="row" className="px-4 py-2.5 text-start font-medium">
                {tc(s.service)}
              </th>
              <td className={TD}>{nf(s.bookings)}</td>
              <td className={cn(TD, "font-semibold")}>{money(s.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </ReportSection>

      <ReportSection id="by-salon" title={m.bySalon} action={exportLink("salon")}>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {[m.colSalon, m.colCity, m.colPlan, m.bookings, m.revenue, m.colBasket, m.colCancel, m.colNoShow, m.colRating].map((h) => (
              <th key={h} scope="col" className={TH}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {r.salons.map((s) => (
            <tr key={s.id}>
              <th scope="row" className="px-4 py-2.5 text-start font-semibold">
                {s.name}
              </th>
              <td className="px-4 py-2.5 whitespace-nowrap">{tc(s.city)}</td>
              <td className="px-4 py-2.5">{t.admin.plans[s.plan as keyof typeof t.admin.plans] ?? s.plan}</td>
              <td className={TD}>{nf(s.bookings)}</td>
              <td className={cn(TD, "font-semibold")}>{money(s.revenue)}</td>
              <td className={TD}>{money(s.avgBasket)}</td>
              <td className={TD}>{pct(s.cancelRate)}</td>
              <td className={TD}>{pct(s.noShowRate)}</td>
              <td className={TD}>{s.reviews ? nf(s.rating) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </ReportSection>
    </div>
  );
}

function ReportSection({ id, title, action, children }: { id: string; title: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl bg-card ring-1 ring-border print:break-inside-avoid">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {action}
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">{children}</table>
      </div>
    </section>
  );
}
