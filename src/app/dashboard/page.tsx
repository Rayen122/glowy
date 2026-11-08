import Link from "next/link";
import { ArrowRight, CalendarCheck, CircleCheck, CircleDot, Coins, Gauge, Hourglass, Lightbulb, ShieldAlert, Star, TrendingDown, Users, UserX } from "lucide-react";
import { AffluenceHeatmap } from "@/components/charts/affluence-heatmap";
import { BarList } from "@/components/charts/bar-list";
import { RevenueBars } from "@/components/charts/revenue-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { BookingStatusActions } from "@/components/dashboard/booking-status";
import { getI18n } from "@/i18n/server";
import { HEATMAP_HOURS, weekdayIso } from "@/lib/data";
import { employeeDay, recentSalonReviews, salonKpis, salonStats, staffSalon } from "@/modules/dashboard";
import { ownEmployee } from "@/modules/identity";
import type { Actor } from "@/core/domain/actor";
import { requirePageUser } from "@/infrastructure/session";
import { tunisToday } from "@/core/domain/time";
import { cn } from "@/lib/utils";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { salonWeekForecast } from "@/modules/affluence";
import { SUSPICION_ALERT } from "@/modules/reviews";
import { planAccess } from "@/modules/subscription";

const STATUS_STYLE = {
  termine: { className: "text-muted-foreground", icon: CircleCheck },
  en_cours: { className: "text-plum-700", icon: CircleDot },
  confirme: { className: "text-success", icon: CalendarCheck },
  a_confirmer: { className: "text-warning", icon: Hourglass },
  absent: { className: "text-destructive", icon: UserX },
} as const;

const SERIES_BG = ["", "bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];
const PERIODS = ["today", "d7", "d30", "month"] as const;

export default async function DashboardPage() {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const salon = await staffSalon(user);
  if (user.role === "EMPLOYEE") return <EmployeeDay actor={user} firstName={user.firstName} salonId={salon.id} />;
  const access = await planAccess(salon.id);
  const [{ t, tc, f, nf, money, df, hour }, kpis, reviews, stats30, week] = await Promise.all([
    getI18n(),
    salonKpis(salon.id),
    recentSalonReviews(salon.id),
    salonStats(salon.id, 30),
    // IA P2 : vraie prévision de la semaine (plan Pro et Premium)
    access.features.includes("affluence") ? salonWeekForecast(salon.id, HEATMAP_HOURS) : null,
  ]);
  const d = t.dashboard;
  const o = d.overview;
  const today = tunisToday();
  // Statistiques réelles sur 30 jours (SAL-06)
  const total30 = stats30.revenue;
  // « Prochains » = pas encore fini ; les rendez-vous passés encore ouverts sont à pointer depuis l'agenda
  const open = kpis.day.bookings.filter((b) => b.status !== "COMPLETED" && b.status !== "NO_SHOW");
  const upcoming = open.filter((b) => b.end > kpis.nowTime).slice(0, 6);
  const toCheck = open.filter((b) => b.end <= kpis.nowTime).length;
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
          {week ? (
            <>
              <div className="mt-5">
                <AffluenceHeatmap days={week.days} hours={HEATMAP_HOURS} values={week.values} />
              </div>
              <ul className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {week.peak && (
                  <li className="flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
                    <Users className="mt-0.5 size-4 shrink-0 text-plum-700" aria-hidden />
                    <span>
                      <span className="font-semibold">{f(o.peakTitle, { day: weekday(week.peak.weekday), range: f(t.common.range, { from: hour(week.peak.from), to: hour(week.peak.to) }) })}</span>{" "}
                      <span className="text-muted-foreground">{o.peakText}</span>
                    </span>
                  </li>
                )}
                {week.low && (
                  <li className="flex gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
                    <TrendingDown className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>
                      <span className="font-semibold">{f(o.lowTitle, { day: weekday(week.low.weekday), range: f(t.common.range, { from: hour(week.low.from), to: hour(week.low.to) }) })}</span>{" "}
                      <span className="text-muted-foreground">{f(o.lowText, { pts: f(t.common.plusPoints, { n: 10 }) })}</span>{" "}
                      <Link href="/dashboard/promotions" className="font-semibold text-plum-700 hover:underline">
                        {o.createOffer}
                      </Link>
                    </span>
                  </li>
                )}
              </ul>
            </>
          ) : (
            <PlanUpsell feature="affluence" canUpgrade compact className="mt-5" />
          )}
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
                    <BookingStatusActions bookingId={b.id} actions={b.actions} />
                  </div>
                </li>
              );
            })}
            {upcoming.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{d.noMoreToday}</li>}
          </ul>
          {toCheck > 0 && (
            <Link href="/dashboard/agenda" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline">
              {f(d.toCheck, { n: toCheck })} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          )}
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
              {stats30.revenueChange != null && (
                <span className={cn("ms-2 text-xs font-semibold", stats30.revenueChange >= 0 ? "text-success" : "text-destructive")} dir="ltr">
                  {stats30.revenueChange >= 0 ? "+" : "−"}
                  {nf(Math.abs(Math.round(stats30.revenueChange * 1000) / 10))} %
                </span>
              )}
            </p>
          </div>
          <div className="mt-5">
            <RevenueBars data={stats30.series} />
          </div>
        </section>

        {/* Services populaires */}
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="popular-title">
          <h2 id="popular-title" className="font-semibold">
            {o.popularTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{o.popularHint}</p>
          <BarList className="mt-5" items={stats30.services.slice(0, 5).map((s) => ({ label: tc(s.name), value: s.count }))} />
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
            const suspicious = r.suspicion >= SUSPICION_ALERT;
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

/** « Ma journée » de l'employé : ses rendez-vous et ses chiffres, sans le chiffre d'affaires ni la gestion du salon */
async function EmployeeDay({ actor, firstName, salonId }: { actor: Actor; firstName: string; salonId: string }) {
  const [{ t, tc, f, nf, df }, me] = await Promise.all([getI18n(), ownEmployee(actor)]);
  const d = t.dashboard;
  const e = d.employee;
  const today = tunisToday();
  const header = (
    <header>
      <p className="text-sm text-muted-foreground first-letter:uppercase">{df(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <h1 data-animate="split" className="display mt-1 text-3xl text-ink sm:text-4xl">
        {f(t.account.overview.hello, { name: firstName })}
      </h1>
    </header>
  );
  if (!me) {
    return (
      <div className="space-y-6">
        {header}
        <p className="rounded-2xl bg-sand p-4 text-sm font-medium text-plum-800 ring-1 ring-border">{e.noProfile}</p>
      </div>
    );
  }
  const day = await employeeDay(salonId, me.id);
  const done = day.bookings.filter((b) => b.status === "COMPLETED").length;
  const open = day.bookings.filter((b) => b.status !== "COMPLETED" && b.status !== "NO_SHOW");
  const upcoming = open.filter((b) => b.end > day.nowTime);
  const toCheck = open.length - upcoming.length;
  const next = upcoming[0];

  return (
    <div className="space-y-6">
      {header}
      <section data-animate="stagger" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label={e.kpiAria}>
        <StatTile label={e.today} value={nf(day.bookings.length)} icon={<CalendarCheck />} />
        <StatTile label={e.done} value={nf(done)} icon={<CircleCheck />} />
        <StatTile label={e.next} value={next ? next.time : e.nextNone} icon={<Hourglass />} />
        <StatTile label={e.month} value={nf(day.month)} icon={<Star />} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="my-day-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="my-day-title" className="font-semibold">
              {e.upcoming}
            </h2>
            <Link href="/dashboard/agenda" className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">
              {d.nav.myAgenda} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {upcoming.map((b) => {
              const st = STATUS_STYLE[b.uiStatus];
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className={cn("h-10 w-1 shrink-0 rounded-full", SERIES_BG[b.color])} aria-hidden />
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">{b.time}</span>
                  <span className="min-w-32 flex-1">
                    <span className="block truncate text-sm font-medium">{b.client}</span>
                    <span className="block truncate text-xs text-muted-foreground">{tc(b.service)}</span>
                  </span>
                  <span className={cn("ms-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium", st.className)}>
                    <st.icon className="size-3.5" aria-hidden />
                    {d.bookingStatus[b.uiStatus]}
                  </span>
                  <div className="ms-auto">
                    <BookingStatusActions bookingId={b.id} actions={b.actions} />
                  </div>
                </li>
              );
            })}
            {upcoming.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{e.empty}</li>}
          </ul>
          {toCheck > 0 && (
            <Link href="/dashboard/agenda" className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline">
              {f(d.toCheck, { n: toCheck })} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          )}
        </section>
        <section className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="my-week-title">
          <h2 id="my-week-title" className="font-semibold">
            {e.week}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{f(e.weekText, { n: day.week })}</p>
        </section>
      </div>
    </div>
  );
}
