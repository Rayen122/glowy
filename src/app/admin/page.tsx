import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Coins, Store, Users } from "lucide-react";
import { ModerationQueue, PendingSalons } from "@/components/admin/admin-queues";
import { BarList } from "@/components/charts/bar-list";
import { BookingsArea } from "@/components/charts/bookings-area";
import { StatTile } from "@/components/charts/stat-tile";
import type { PlanId } from "@/core/domain/enums";
import { getI18n } from "@/i18n/server";
import { BOOKINGS_BY_MONTH, TOP_CITIES_ADMIN } from "@/lib/data";
import { cn } from "@/lib/utils";
import { adminOverview, adminQueues } from "@/modules/admin";
import { requirePageUser } from "@/infrastructure/session";
import { tunisToday } from "@/core/domain/time";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.overview };
}

const PLAN_COLOR = ["bg-series-1", "bg-series-2", "bg-series-3"];
const PERIODS = ["d7", "d30", "m12"] as const;

export default async function AdminPage() {
  await requirePageUser("ADMIN");
  const [{ t, tc, f, nf, money, df, ago }, overview, queues] = await Promise.all([getI18n(), adminOverview(), adminQueues()]);
  const a = t.admin;
  const o = a.overview;
  const PLAN_SPLIT = (["gratuit", "pro", "premium"] as PlanId[]).map((plan) => ({ plan, salons: overview.plans.find((p) => p.plan === plan)?.count ?? 0 }));
  const totalPlans = Math.max(1, PLAN_SPLIT.reduce((acc, p) => acc + p.salons, 0));
  const actions = a.audit.actions as Record<string, string>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {df(tunisToday(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {o.dataRange}
          </p>
          <h1 data-animate="split" className="display mt-1 text-3xl text-ink sm:text-4xl">
            {a.nav.overview}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t.dashboard.periodAria}>
          {PERIODS.map((p, i) => (
            <button
              key={p}
              type="button"
              aria-pressed={i === 1}
              className={cn(
                "h-9 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                i === 1 ? "bg-ink text-white" : "border border-border bg-card hover:bg-muted"
              )}
            >
              {a.periods[p]}
            </button>
          ))}
        </div>
      </header>

      <section data-animate="stagger" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label={o.kpiAria}>
        <StatTile label={o.kpiSalons} value={nf(overview.salons)} icon={<Store />} />
        <StatTile label={o.kpiClients} value={nf(overview.clients)} icon={<Users />} />
        <StatTile label={o.kpiBookings} value={nf(overview.bookings30d)} icon={<CalendarCheck />} />
        <StatTile label={o.kpiRevenue} value={money(overview.revenue30d)} icon={<Coins />} />
      </section>

      <div data-animate="stagger" data-stagger="0.12" className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="growth-title">
          <h2 id="growth-title" className="font-semibold">
            {o.growthTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{o.growthHint}</p>
          <div className="mt-4">
            <BookingsArea data={BOOKINGS_BY_MONTH} />
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="plans-title">
            <h2 id="plans-title" className="font-semibold">
              {o.plansTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{f(o.salonsCount, { n: nf(totalPlans) })}</p>
            <div
              className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded-full"
              role="img"
              aria-label={PLAN_SPLIT.map((p) => `${a.plans[p.plan]} ${nf(p.salons)}`).join(", ")}
            >
              {PLAN_SPLIT.map((p, i) => (
                <span key={p.plan} data-animate="grow-x" className={PLAN_COLOR[i]} style={{ width: `${(p.salons / totalPlans) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-3 gap-3">
              {PLAN_SPLIT.map((p, i) => (
                <li key={p.plan} className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-2.5 shrink-0 rounded-[3px]", PLAN_COLOR[i])} aria-hidden /> <span className="truncate">{a.plans[p.plan]}</span>
                  </p>
                  <p className="mt-1 text-lg font-semibold">{nf(p.salons)}</p>
                  <p className="text-xs text-muted-foreground">{nf(p.salons / totalPlans, { style: "percent" })}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="cities-title">
            <h2 id="cities-title" className="font-semibold">
              {o.citiesTitle}
            </h2>
            <BarList className="mt-4" items={TOP_CITIES_ADMIN.map((c) => ({ label: tc(c.city), value: c.bookings }))} />
          </section>
        </div>
      </div>

      <div data-animate="stagger" data-stagger="0.12" className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="pending-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="pending-title" className="font-semibold">
                {o.pendingTitle}
              </h2>
              <p className="text-sm text-muted-foreground">{o.pendingHint}</p>
            </div>
            <Link href="/admin/salons" className="shrink-0 text-sm font-semibold text-plum-700 hover:underline">
              {o.allSalons}
            </Link>
          </div>
          <div className="mt-4">
            <PendingSalons initial={queues.pending} />
          </div>
        </section>

        <section className="min-w-0 rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="moderation-title">
          <h2 id="moderation-title" className="font-semibold">
            {o.moderationTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{o.moderationHint}</p>
          <div className="mt-4">
            <ModerationQueue initial={queues.flagged} />
          </div>
        </section>
      </div>

      <section data-animate="fade-up" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6" aria-labelledby="audit-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="audit-title" className="font-semibold">
            {t.modules.admin.audit.title}
          </h2>
          <Link href="/admin/audit" className="shrink-0 text-sm font-semibold text-plum-700 hover:underline">
            {o.allAudit}
          </Link>
        </div>
        <ol data-animate="stagger" data-stagger="0.08" className="mt-4 space-y-3">
          {overview.audit.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-start sm:gap-3">
              <span className="flex flex-1 items-start gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-plum-300" aria-hidden />
                <span>
                  <span className="font-semibold">
                    {entry.actor ? f(a.audit.actor, { name: entry.actor.firstName, role: a.audit.roles.admin }) : a.audit.system}
                  </span>{" "}
                  {f(actions[entry.action] ?? entry.action, { target: (entry.meta as { name?: string } | null)?.name ?? "" })}
                </span>
              </span>
              <span className="shrink-0 ps-5 text-xs text-muted-foreground sm:ps-0">{ago(entry.minutesAgo)}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
