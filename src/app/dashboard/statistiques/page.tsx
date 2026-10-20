import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarX, Coins, Download, ShoppingBag, UserPlus, UserX } from "lucide-react";
import { AffluenceHeatmap } from "@/components/charts/affluence-heatmap";
import { BarList } from "@/components/charts/bar-list";
import { RevenueBars } from "@/components/charts/revenue-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { ManageHeader, PrintButton } from "@/components/manage/kit";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { salonStats, STAT_PERIODS, staffSalon, type StatPeriod } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.stats.title };
}

const DOT: Record<number, string> = { 1: "bg-series-1", 2: "bg-series-2", 3: "bg-series-3", 4: "bg-series-4", 5: "bg-series-5" };

/** SAL-06 : statistiques réelles ; SAL-11 : export Excel (CSV) et impression PDF */
export default async function StatisticsPage({ searchParams }: PageProps<"/dashboard/statistiques">) {
  const user = await requirePageUser("MANAGER", "ADMIN");
  const sp = await searchParams;
  const asked = Number(Array.isArray(sp.periode) ? sp.periode[0] : sp.periode);
  const days: StatPeriod = (STAT_PERIODS as readonly number[]).includes(asked) ? (asked as StatPeriod) : 30;
  const salon = await staffSalon(user);
  const [{ t, f, tc, nf, money }, stats] = await Promise.all([getI18n(), salonStats(salon.id, days)]);
  const m = t.manage.stats;
  const period = m.periods[String(days) as keyof typeof m.periods];
  const percent = (v: number) => nf(v, { style: "percent", maximumFractionDigits: 1 });

  return (
    <div className="space-y-6">
      <ManageHeader
        title={`${m.title} · ${salon.name}`}
        description={m.description}
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <a href={`/api/dashboard/stats/export?days=${days}`} download className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted" title={m.exportHint}>
              <Download className="size-4" aria-hidden /> {t.manage.common.exportCsv}
            </a>
            <PrintButton label={t.manage.common.print} />
          </div>
        }
      />

      <nav aria-label={m.periodAria} className="flex flex-wrap gap-2 print:hidden">
        {STAT_PERIODS.map((p) => (
          <Link
            key={p}
            href={`?periode=${p}`}
            aria-current={p === days ? "page" : undefined}
            className={cn("inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ring-1", p === days ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
          >
            {m.periods[String(p) as keyof typeof m.periods]}
          </Link>
        ))}
      </nav>
      <p className="hidden text-sm font-semibold print:block">{period}</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label={m.revenue}
          value={money(stats.revenue)}
          icon={<Coins />}
          {...(stats.revenueChange != null ? { delta: Math.round(stats.revenueChange * 1000) / 10, period: f(m.vsPrevious, { change: "" }).trim() } : {})}
        />
        <StatTile label={m.bookings} value={nf(stats.bookings)} icon={<CalendarCheck />}>
          <p className="mt-1 text-xs text-muted-foreground">{f(m.bookingsHint, { n: nf(stats.completed) })}</p>
        </StatTile>
        <StatTile label={m.basket} value={money(stats.averageBasket)} icon={<ShoppingBag />} />
        <StatTile label={m.cancelRate} value={percent(stats.cancelRate)} icon={<CalendarX />}>
          <p className="mt-1 text-xs text-muted-foreground">{f(m.rateHint, { n: nf(stats.cancelled) })}</p>
        </StatTile>
        <StatTile label={m.noShowRate} value={percent(stats.noShowRate)} icon={<UserX />}>
          <p className="mt-1 text-xs text-muted-foreground">{f(m.rateHint, { n: nf(stats.noShows) })}</p>
        </StatTile>
        <StatTile label={m.newClients} value={nf(stats.newClients)} icon={<UserPlus />}>
          <p className="mt-1 text-xs text-muted-foreground">{m.newClientsHint}</p>
        </StatTile>
      </div>

      {stats.bookings === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.empty}</p>
      ) : (
        <>
          <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="rev-title">
            <h2 id="rev-title" className="font-semibold">
              {stats.monthly ? m.revenueChartMonthly : m.revenueChart}
            </h2>
            <p className="text-sm text-muted-foreground">
              {m.revenueHint} · {period}
            </p>
            <div className="mt-5">
              <RevenueBars data={stats.series} monthly={stats.monthly} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="svc-title">
              <h2 id="svc-title" className="font-semibold">
                {m.services}
              </h2>
              <p className="text-sm text-muted-foreground">{m.servicesHint}</p>
              <BarList className="mt-5" items={stats.services.map((s) => ({ label: tc(s.name), value: s.count }))} />
            </section>
            <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="peak-title">
              <h2 id="peak-title" className="font-semibold">
                {m.peaks}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">{m.peaksHint}</p>
              <AffluenceHeatmap days={stats.peaks.days} hours={stats.peaks.hours} values={stats.peaks.values} />
            </section>
          </div>

          <section className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="team-title">
            <h2 id="team-title" className="mb-3 font-semibold">
              {m.team}
            </h2>
            <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2.5 pe-3 text-start font-medium">{m.colName}</th>
                    <th scope="col" className="px-3 py-2.5 text-end font-medium">{m.colBookings}</th>
                    <th scope="col" className="px-3 py-2.5 text-end font-medium">{m.colRevenue}</th>
                    <th scope="col" className="px-3 py-2.5 text-end font-medium">{m.colNoShows}</th>
                    <th scope="col" className="ps-3 py-2.5 text-end font-medium">{m.colCommission}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.byEmployee.map((e) => (
                    <tr key={e.name}>
                      <td className="py-3 pe-3 font-medium">
                        <span className="flex items-center gap-2">
                          <span className={cn("size-2.5 rounded-full", DOT[e.color] ?? DOT[1])} aria-hidden /> {e.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-end tabular-nums">{nf(e.count)}</td>
                      <td className="px-3 py-3 text-end font-semibold tabular-nums">{money(e.revenue)}</td>
                      <td className="px-3 py-3 text-end tabular-nums">{nf(e.noShows)}</td>
                      <td className="ps-3 py-3 text-end tabular-nums">
                        {e.rate > 0 ? (
                          <>
                            <span className="font-semibold">{money(e.commission)}</span>
                            <span className="block text-xs text-muted-foreground">{nf(e.rate)} %</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
