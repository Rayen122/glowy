import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BlockSlotButton, SalonSetupCard, UnblockButton } from "@/components/dashboard/agenda-actions";
import { AgendaMonth, AgendaWeek } from "@/components/dashboard/agenda-views";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { salonDay, staffSalon } from "@/modules/dashboard";
import { requirePageUser } from "@/infrastructure/session";
import { ownEmployee } from "@/modules/identity";
import { addDays, isIsoDate, tunisToday, utcToTunis } from "@/core/domain/time";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { planAccess } from "@/modules/subscription";
import { AgendaBooking } from "@/components/dashboard/agenda-booking";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.dashboard.agenda.title };
}

const START = 8 * 60; // 08:00
const END = 20 * 60; // 20:00
const PX_PER_MIN = 1.6; // 48 px par demi-heure

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Couleurs par employé (SAL-04) — palette catégorielle validée, ordre fixe */
const TINT: Record<number, { bar: string; bg: string; dot: string }> = {
  1: { bar: "border-s-series-1", bg: "bg-series-1/10", dot: "bg-series-1" },
  2: { bar: "border-s-series-2", bg: "bg-series-2/10", dot: "bg-series-2" },
  3: { bar: "border-s-series-3", bg: "bg-series-3/12", dot: "bg-series-3" },
  4: { bar: "border-s-series-4", bg: "bg-series-4/10", dot: "bg-series-4" },
  5: { bar: "border-s-series-5", bg: "bg-series-5/10", dot: "bg-series-5" },
};

/** Agenda du jour (SAL-04) : ?date=AAAA-MM-JJ, colonnes par employé, réservations et blocages réels */
export default async function AgendaPage({ searchParams }: PageProps<"/dashboard/agenda">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { date: requested, vue } = await searchParams;
  const view = vue === "semaine" ? "week" : vue === "mois" ? "month" : "day";
  const today = tunisToday();
  const date = typeof requested === "string" && isIsoDate(requested) ? requested : today;
  const salon = await staffSalon(user);
  const [{ t, tc, f, df }, day, access] = await Promise.all([getI18n(), salonDay(salon.id, date), planAccess(salon.id)]);
  const a = t.dashboard.agenda;
  // Employé : seulement sa colonne et ses rendez-vous, pas ceux de ses collègues
  const me = user.role === "EMPLOYEE" ? await ownEmployee(user) : null;
  if (user.role === "EMPLOYEE") {
    day.employees = day.employees.filter((e) => e.id === me?.id);
    day.bookings = day.bookings.filter((b) => b.employeeId === me?.id);
  }
  const EMPLOYEES = day.employees.map((e) => ({ id: e.id, name: e.name, avatar: e.avatarUrl, color: e.color, hours: e.workingHours }));
  const clamp = (minutes: number) => Math.min(END, Math.max(START, minutes));
  const now = utcToTunis(new Date());
  const NOW = date === today ? toMin(now.time) : null;
  const hours = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => START / 60 + i);
  const height = (END - START) * PX_PER_MIN;
  /** Plages indisponibles d'un professionnel : jour fermé, ou hors horaires (les siens, sinon ceux du salon) */
  const unavailable = (own: { startsAt: string; endsAt: string } | null) => {
    const open = own ? { opensAt: own.startsAt, closesAt: own.endsAt } : day.opening;
    if (!open) return [{ from: START, to: END }];
    return [
      { from: START, to: clamp(toMin(open.opensAt)) },
      { from: clamp(toMin(open.closesAt)), to: END },
    ].filter((r) => r.to > r.from);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 data-animate="split" className="display text-4xl text-ink">
            {a.title}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-muted p-1" role="group" aria-label={a.viewAria}>
            {(["day", "week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={`?${v === "day" ? "" : `vue=${v === "week" ? "semaine" : "mois"}&`}date=${date}`}
                aria-current={view === v ? "page" : undefined}
                className={cn("inline-flex h-11 items-center rounded-full px-4 text-sm font-medium lg:h-9", view === v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {a.views[v]}
              </Link>
            ))}
          </div>
          {user.role !== "EMPLOYEE" && <BlockSlotButton employees={EMPLOYEES.map((e) => ({ id: e.id, name: e.name }))} date={date} />}
        </div>
      </header>

      {view !== "day" && !access.features.includes("agendaViews") && <PlanUpsell feature="agendaViews" canUpgrade={user.role !== "EMPLOYEE"} compact />}
      {view === "week" && access.features.includes("agendaViews") && <AgendaWeek salonId={salon.id} date={date} />}
      {view === "month" && access.features.includes("agendaViews") && <AgendaMonth salonId={salon.id} date={date} />}
      {view === "day" && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href={`?date=${addDays(date, -1)}`} className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted" aria-label={a.prevDay}>
            <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
          <Link href="?" className={cn("inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted", date === today ? "bg-ink text-white hover:bg-plum-800" : "bg-card")}>
            {t.common.today}
          </Link>
          <Link href={`?date=${addDays(date, 1)}`} className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted" aria-label={a.nextDay}>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
          <p className="ms-2 font-semibold first-letter:uppercase">{df(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          {EMPLOYEES.length > 0 && !day.opening && <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{a.closedDay}</span>}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={a.legendAria}>
          {EMPLOYEES.map((e) => (
            <li key={e.id} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", TINT[e.color].dot)} aria-hidden />
              {e.name}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="hatch size-2.5 rounded-sm ring-1 ring-border" aria-hidden /> {a.unavailable}
          </li>
        </ul>
      </div>

      {EMPLOYEES.length === 0 ? (
        user.role === "MANAGER" ? (
          <SalonSetupCard />
        ) : (
          <p className="rounded-3xl bg-card p-10 text-center text-sm text-muted-foreground ring-1 ring-border">{a.noTeamText}</p>
        )
      ) : (
      /* Téléphone : défilement horizontal par colonne (aimantation), colonne des heures fixe */
      <div data-animate="fade-up" className="snap-x snap-mandatory scroll-ps-16 overflow-x-auto overscroll-x-contain rounded-3xl bg-card ring-1 ring-border">
        <div className="min-w-[600px] sm:min-w-[760px]">
          {/* En-têtes colonnes */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: `64px repeat(${EMPLOYEES.length}, minmax(0, 1fr))` }}>
            <div className="sticky start-0 z-20 bg-card" />
            {EMPLOYEES.map((e) => {
              const count = day.bookings.filter((b) => b.employeeId === e.id).length;
              return (
                <div key={e.id} className="flex snap-start items-center gap-2.5 border-s border-border px-3 py-3 sm:px-4">
                  <Avatar className="size-8">
                    {e.avatar && <AvatarImage src={e.avatar} alt="" />}
                    <AvatarFallback className="bg-blush text-xs font-semibold text-plum-700">{e.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className={cn("size-2 rounded-full", TINT[e.color].dot)} aria-hidden />
                      {e.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{f(a.bookingsCount, { n: count })}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grille horaire */}
          <div data-animate="stagger" data-stagger="0.1" className="relative grid" style={{ gridTemplateColumns: `64px repeat(${EMPLOYEES.length}, minmax(0, 1fr))`, height }}>
            {/* Heures */}
            <div className="sticky start-0 z-20 bg-card">
              {hours.map((h) => (
                <span
                  key={h}
                  className="absolute end-3 -translate-y-1/2 text-xs text-muted-foreground tabular-nums"
                  style={{ top: (h * 60 - START) * PX_PER_MIN }}
                >
                  {h === START / 60 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>

            {EMPLOYEES.map((e) => (
              <div key={e.id} className="relative border-s border-border" aria-label={f(a.planningOf, { name: e.name })}>
                {/* lignes */}
                {hours.slice(0, -1).map((h) => (
                  <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: (h * 60 - START) * PX_PER_MIN }}>
                    <div className="border-t border-dashed border-border/40" style={{ marginTop: 30 * PX_PER_MIN - 1 }} />
                  </div>
                ))}

                {unavailable(e.hours).map((r) => (
                  <div key={r.from} className="hatch pointer-events-none absolute inset-x-0 bg-muted/40" style={{ top: (r.from - START) * PX_PER_MIN, height: (r.to - r.from) * PX_PER_MIN }} aria-hidden />
                ))}

                {day.blocks.filter((b) => b.employeeId === e.id).map((b) => (
                  <div
                    key={b.id}
                    className="hatch absolute inset-x-1.5 flex items-start rounded-lg bg-muted/40 py-1.5 ps-2.5 pe-8 text-xs font-medium text-muted-foreground ring-1 ring-border"
                    style={{ top: (clamp(toMin(b.time)) - START) * PX_PER_MIN + 2, height: Math.max(28, (clamp(toMin(b.end)) - clamp(toMin(b.time))) * PX_PER_MIN - 4) }}
                  >
                    {tc(b.label)}
                    {user.role !== "EMPLOYEE" && <UnblockButton id={b.id} label={tc(b.label)} />}
                  </div>
                ))}

                {day.bookings.filter((b) => b.employeeId === e.id).map(({ uiStatus, ...b }) => {
                  const top = (clamp(toMin(b.time)) - START) * PX_PER_MIN + 2;
                  const h = Math.max(24, (clamp(toMin(b.end)) - clamp(toMin(b.time))) * PX_PER_MIN - 4);
                  const tint = TINT[e.color] ?? TINT[1];
                  const status = uiStatus;
                  return (
                    <AgendaBooking
                      key={b.id}
                      booking={{
                        id: b.id,
                        time: b.time,
                        end: b.end,
                        dateLabel: df(date, { weekday: "long", day: "numeric", month: "long" }),
                        clientId: b.clientId,
                        clientFullName: b.clientFullName || b.client,
                        clientPhone: b.clientPhone,
                        service: tc(b.service),
                        employeeName: e.name,
                        statusLabel: t.dashboard.bookingStatus[status],
                        price: b.price,
                        deposit: b.deposit,
                        note: b.note,
                        actions: b.actions,
                      }}
                      className={cn(
                        "absolute inset-x-1.5 flex flex-col justify-start overflow-hidden rounded-lg border-s-[3px] px-2.5 py-1.5 text-start transition-shadow hover:shadow-soft focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        tint.bar,
                        tint.bg,
                        status === "termine" && "opacity-60",
                        status === "absent" && "hatch opacity-80",
                        status === "en_cours" && "ring-2 ring-ink/80"
                      )}
                      style={{ top, height: h }}
                      ariaLabel={f(a.slotAria, { from: b.time, to: b.end, client: b.client, service: tc(b.service), status: t.dashboard.bookingStatus[status] })}
                    >
                      <p className="truncate text-xs font-medium text-muted-foreground tabular-nums">
                        <span dir="ltr">
                          {b.time} – {b.end}
                        </span>
                        {status === "en_cours" && <span className="ms-1.5 font-semibold text-ink">· {a.inProgress}</span>}
                        {status === "absent" && <span className="ms-1.5 font-semibold text-destructive">· {a.absent}</span>}
                      </p>
                      <p className={cn("truncate text-sm font-semibold text-foreground", status === "absent" && "line-through")}>{b.client}</p>
                      {h > 56 && <p className="truncate text-xs text-muted-foreground">{tc(b.service)}</p>}
                    </AgendaBooking>
                  );
                })}
              </div>
            ))}

            {/* Maintenant */}
            {NOW !== null && NOW >= START && NOW <= END && (
              <div className="pointer-events-none absolute inset-x-0 z-30 flex items-center" style={{ top: (NOW - START) * PX_PER_MIN }} aria-hidden>
                <span className="w-16 pe-2 text-end text-xs font-bold text-destructive tabular-nums">{now.time}</span>
                <span className="-ms-1 size-2 rounded-full bg-destructive" />
                <span className="h-px flex-1 bg-destructive" />
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      </>
      )}
    </div>
  );
}
