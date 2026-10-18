import Link from "next/link";
import { ArrowRight, CalendarCheck, CircleCheck, CircleDot, Coins, Gauge, Lightbulb, ShieldAlert, Star, TrendingDown, UserX, Users } from "lucide-react";
import { AffluenceHeatmap } from "@/components/charts/affluence-heatmap";
import { BarList } from "@/components/charts/bar-list";
import { RevenueBars } from "@/components/charts/revenue-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { BookingStatusActions } from "@/components/dashboard/booking-status";
import { getI18n } from "@/i18n/server";
import { AFFLUENCE_FORECAST, HEATMAP_DAYS, HEATMAP_HOURS, POPULAR_SERVICES, REVENUE_30D, weekdayIso } from "@/lib/data";
import { recentSalonReviews, salonKpis, staffSalon } from "@/modules/dashboard";
import { requirePageUser } from "@/infrastructure/session";
import { tunisToday } from "@/core/domain/time";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  termine: { className: "text-muted-foreground", icon: CircleCheck },
  en_cours: { className: "text-plum-700", icon: CircleDot },
  confirme: { className: "text-success", icon: CalendarCheck },
  absent: { className: "text-destructive", icon: UserX },
} as const;

const SERIES_BG = ["", "bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];
const PERIODS = ["today", "d7", "d30", "month"] as const;

export default async function DashboardPage() {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t, tc, f, nf, money, df, hour }, kpis, reviews] = await Promise.all([getI18n(), salonKpis(salon.id), recentSalonReviews(salon.id)]);
  const d = t.dashboard;
  const o = d.overview;
  const today = tunisToday();
  // Statistiques sur 30 jours (SAL-06, P2) : données de démonstration en attendant le module statistiques
  const total30 = REVENUE_30D.reduce((a, x) => a + x.revenue, 0);
  const upcoming = kpis.day.bookings.filter((b) => b.status !== "COMPLETED" && b.status !== "NO_SHOW").slice(0, 6);
  const weekday = (w: number) => df(weekdayIso(w), { weekday: "long" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">{df(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 data-animate="split" className="display mt-1 text-3xl text-ink sm:text-4xl">
            {f(t.account.overview.hello, { name: user.firstName })}
          </h1>
        </div>
        <div className="no-scrollbar -mx-4 flex max-w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:mx-0 sm:max-w-none sm:flex-wrap sm:px-0" role="group" aria-label={d.periodAria}>
          {PERIODS.map((p, i) => (
            <button
              key={p}
              type="button"
              aria-pressed={i === 0}
              className={cn(
                "h-11 shrink-0 rounded-full px-3.5 lg:h-9 text-sm font-medium whitespace-nowrap transition-colors",
                i === 0 ? "bg-ink text-white" : "border border-border bg-card hover:bg-muted"
              )}
            >
              {d.periods[p]}
            </button>
          ))}
        </div>
      </header>

      {/* KPI */}
      <section data-animate="stagger" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label={o.kpiAria}>
        <StatTile label={o.kpiBookings} value={nf(kpis.bookingsToday)} icon={<CalendarCheck />} />
        <StatTile label={o.kpiRevenue} value={money(kpis.revenueToday)} icon={<Coins />} />
        <StatTile label={o.kpiFill} value={nf(kpis.fillRate, { style: "percent" })} icon={<Gauge />}>
          <div className="mt-3 h-2 rounded-full bg-plum-100" role="img" aria-label={f(o.fillAria, { n: Math.round(kpis.fillRate * 100) })}>
            <div data-animate="grow-x" className="h-full rounded-full bg-plum-600" style={{ width: `${Math.round(kpis.fillRate * 100)}%` }} />
          </div>
        </StatTile>
        <StatTile label={o.kpiNoShows} value={nf(kpis.noShows30)} icon={<UserX />} />
      </section>

      <div data-animate="stagger" data-stagger="0.12" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Prévision d'affluence */}
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="forecast-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="forecast-title" className="font-semibold">
                {f(o.forecastTitle, { date: df(today, { day: "numeric", month: "short" }) })}
              </h2>
              <p className="text-sm text-muted-foreground">{o.forecastHint}</p>
            </div>
            <span className="rounded-full bg-blush px-2.5 py-1 text-xs font-semibold text-plum-700">{t.common.ai}</span>
          </div>
          <div className="mt-5">
            <AffluenceHeatmap days={HEATMAP_DAYS} hours={HEATMAP_HOURS} values={AFFLUENCE_FORECAST} />
          </div>
          <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <li className="flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
              <Users className="mt-0.5 size-4 shrink-0 text-plum-700" aria-hidden />
              <span>
                <span className="font-semibold">{f(o.peakTitle, { day: weekday(6), range: f(t.common.range, { from: hour(14), to: hour(17) }) })}</span>{" "}
                <span className="text-muted-foreground">{o.peakText}</span>
              </span>
            </li>
            <li className="flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
              <TrendingDown className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                <span className="font-semibold">{f(o.lowTitle, { day: weekday(2), range: f(t.common.range, { from: hour(9), to: hour(12) }) })}</span>{" "}
                <span className="text-muted-foreground">{f(o.lowText, { pts: f(t.common.plusPoints, { n: 10 }) })}</span>{" "}
                <Link href="/dashboard/promotions" className="font-semibold text-plum-700 hover:underline">
                  {o.createOffer}
                </Link>
              </span>
            </li>
          </ul>
        </section>

        {/* Prochains rendez-vous */}
        <section className="flex min-w-0 flex-col rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="today-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="today-title" className="font-semibold">
              {o.nextTitle}
            </h2>
            <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">
              {d.nav.agenda} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
          <ul data-animate="stagger" data-stagger="0.06" className="mt-4 divide-y divide-border">
            {upcoming.map((b) => {
              const st = STATUS_STYLE[b.uiStatus];
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className={cn("h-10 w-1 shrink-0 rounded-full", SERIES_BG[b.color])} aria-hidden />
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{b.time}</span>
                  <span className="min-w-32 flex-1">
                    <span className="block truncate text-sm font-medium">{b.client}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {tc(b.service)} · {b.employeeName}
                    </span>
                  </span>
                  <span className={cn("ms-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium", st.className)}>
                    <st.icon className="size-3.5" aria-hidden />
                    {d.bookingStatus[b.uiStatus]}
                  </span>
                  <div className="ms-auto">
                    <BookingStatusActions bookingId={b.id} status={b.status} />
                  </div>
                </li>
              );
            })}
            {upcoming.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{d.noMoreToday}</li>}
          </ul>
        </section>
      </div>

      <div data-animate="stagger" data-stagger="0.12" className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* CA */}
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="revenue-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="revenue-title" className="font-semibold">
                {o.revenueTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{o.revenueHint}</p>
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {money(total30)}
              <span className="ms-2 text-xs font-semibold text-success" dir="ltr">
                +{nf(9.4)} %
              </span>
            </p>
          </div>
          <div className="mt-5">
            <RevenueBars data={REVENUE_30D} />
          </div>
        </section>

        {/* Services populaires */}
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="popular-title">
          <h2 id="popular-title" className="font-semibold">
            {o.popularTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{o.popularHint}</p>
          <BarList className="mt-5" items={POPULAR_SERVICES.map((s) => ({ label: tc(s.name), value: s.count }))} />
        </section>
      </div>

      {/* Avis récents */}
      <section data-animate="fade-up" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="reviews-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="reviews-title" className="font-semibold">
              {o.reviewsTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{o.reviewsHint}</p>
          </div>
          <Link href="/dashboard/avis" className="text-sm font-semibold text-plum-700 hover:underline">
            {o.allReviews}
          </Link>
        </div>
        <ul data-animate="stagger" data-stagger="0.1" className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {reviews.map((r) => {
            const suspicious = r.suspicion > 60;
            return (
              <li key={r.id} className={cn("rounded-2xl p-4 ring-1", suspicious ? "bg-danger-soft/60 ring-destructive/20" : "bg-muted/40 ring-border")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{r.author}</p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium" dir="ltr">
                    <Star className="size-3.5 fill-star text-star" aria-hidden /> {r.rating}/5
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground" lang={r.lang} dir="auto">
                  « {r.text} »
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-card px-2 py-0.5 font-medium ring-1 ring-border">{d.sentiment[r.sentiment]}</span>
                  {suspicious ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                      <ShieldAlert className="size-3.5 shrink-0" aria-hidden /> {f(o.suspect, { n: r.suspicion })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{f(o.suspicion, { n: r.suspicion })}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {o.humanDecision}
        </p>
      </section>
    </div>
  );
}
