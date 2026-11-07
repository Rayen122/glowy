import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, tunisToday, weekdayOf } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { salonRange } from "@/modules/dashboard";

/** SAL-04 : vues semaine et mois de l'agenda (couleur = professionnel) */

const BG: Record<number, string> = { 1: "bg-series-1/12 border-s-series-1", 2: "bg-series-2/12 border-s-series-2", 3: "bg-series-3/14 border-s-series-3", 4: "bg-series-4/12 border-s-series-4", 5: "bg-series-5/12 border-s-series-5" };
const DOT: Record<number, string> = { 1: "bg-series-1", 2: "bg-series-2", 3: "bg-series-3", 4: "bg-series-4", 5: "bg-series-5" };

/** Lundi de la semaine contenant `date` */
export const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

function Nav({ prev, next, today, label, current, todayLabel, prevLabel, nextLabel }: { prev: string; next: string; today: string; label: string; current: boolean; todayLabel: string; prevLabel: string; nextLabel: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Link href={prev} className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted" aria-label={prevLabel}>
        <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
      <Link href={today} className={cn("inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted", current ? "bg-ink text-white hover:bg-plum-800" : "bg-card")}>
        {todayLabel}
      </Link>
      <Link href={next} className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card hover:bg-muted" aria-label={nextLabel}>
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
      <p className="ms-2 font-semibold first-letter:uppercase">{label}</p>
    </div>
  );
}

export async function AgendaWeek({ salonId, date }: { salonId: string; date: string }) {
  const { t, f, df, money, nf } = await getI18n();
  const m = t.manage.agenda;
  const from = mondayOf(date);
  const today = tunisToday();
  const data = await salonRange(salonId, from, 7);
  const total = data.days.reduce((a, d) => a + d.bookings.length, 0);
  const revenue = data.days.reduce((a, d) => a + d.revenue, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Nav
          prev={`?vue=semaine&date=${addDays(from, -7)}`}
          next={`?vue=semaine&date=${addDays(from, 7)}`}
          today="?vue=semaine"
          current={mondayOf(today) === from}
          label={f(m.weekRange, { from: df(from, { day: "numeric", month: "long" }), to: df(addDays(from, 6), { day: "numeric", month: "long" }) })}
          todayLabel={m.thisWeek}
          prevLabel={m.prevWeek}
          nextLabel={m.nextWeek}
        />
        <p className="text-sm text-muted-foreground">{f(m.totals, { n: nf(total), revenue: money(revenue) })}</p>
      </div>
      <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        <div className="grid min-w-[840px] grid-cols-7 divide-x divide-border rtl:divide-x-reverse">
          {data.days.map((d) => (
            <section key={d.date} aria-label={df(d.date, { weekday: "long", day: "numeric", month: "long" })} className={cn("min-w-0", d.date === today && "bg-blush/30")}>
              <Link href={`?date=${d.date}`} className="block border-b border-border px-3 py-2.5 hover:bg-muted/60" aria-label={f(m.openDay, { date: df(d.date, { day: "numeric", month: "long" }) })}>
                <p className="text-xs font-medium text-muted-foreground first-letter:uppercase">{df(d.date, { weekday: "short" })}</p>
                <p className={cn("text-lg font-semibold tabular-nums", d.date === today && "text-plum-700")}>{df(d.date, { day: "numeric" })}</p>
                <p className="text-xs text-muted-foreground">{d.open ? (d.bookings.length ? f(m.count, { n: d.bookings.length }) : m.empty) : m.closed}</p>
              </Link>
              <ul className="space-y-1.5 p-2">
                {d.bookings.map((b) => (
                  <li key={b.id} className={cn("rounded-lg border-s-[3px] px-2 py-1.5 text-xs", BG[b.color] ?? BG[1], (b.status === "COMPLETED" || b.status === "NO_SHOW") && "opacity-60")}>
                    <p className="font-semibold tabular-nums" dir="ltr">
                      {b.time} – {b.end}
                    </p>
                    <p className={cn("truncate font-medium", b.status === "NO_SHOW" && "line-through")}>{b.client}</p>
                    <p className="truncate text-muted-foreground">{b.service}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {data.employees.map((e) => (
          <li key={e.id} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", DOT[e.color] ?? DOT[1])} aria-hidden /> {e.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function AgendaMonth({ salonId, date }: { salonId: string; date: string }) {
  const { t, f, df, money, nf } = await getI18n();
  const m = t.manage.agenda;
  const first = `${date.slice(0, 7)}-01`;
  const [y, mo] = first.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const gridStart = mondayOf(first);
  const cells = Math.ceil(((weekdayOf(first) + 6) % 7 + daysInMonth) / 7) * 7;
  const today = tunisToday();
  const data = await salonRange(salonId, gridStart, cells);
  const inMonth = data.days.filter((d) => d.date.startsWith(first.slice(0, 7)));
  const total = inMonth.reduce((a, d) => a + d.bookings.length, 0);
  const revenue = inMonth.reduce((a, d) => a + d.revenue, 0);
  const shift = (months: number) => new Date(Date.UTC(y, mo - 1 + months, 1)).toISOString().slice(0, 10);
  const max = Math.max(1, ...inMonth.map((d) => d.bookings.length));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Nav
          prev={`?vue=mois&date=${shift(-1)}`}
          next={`?vue=mois&date=${shift(1)}`}
          today="?vue=mois"
          current={today.startsWith(first.slice(0, 7))}
          label={df(first, { month: "long", year: "numeric" })}
          todayLabel={m.thisMonth}
          prevLabel={m.prevMonth}
          nextLabel={m.nextMonth}
        />
        <p className="text-sm text-muted-foreground">{f(m.totals, { n: nf(total), revenue: money(revenue) })}</p>
      </div>
      <div className="rounded-3xl bg-card p-2 ring-1 ring-border sm:p-3">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
          {data.days.slice(0, 7).map((d) => (
            <span key={d.date} className="first-letter:uppercase">
              {df(d.date, { weekday: "short" })}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {data.days.map((d) => {
            const outside = !d.date.startsWith(first.slice(0, 7));
            const load = d.bookings.length / max;
            return (
              <Link
                key={d.date}
                href={`?date=${d.date}`}
                aria-label={`${df(d.date, { weekday: "long", day: "numeric", month: "long" })} — ${d.open ? f(m.count, { n: d.bookings.length }) : m.closed}`}
                className={cn(
                  "flex min-h-16 flex-col rounded-xl p-1.5 text-start ring-1 ring-transparent hover:ring-plum-300 sm:min-h-24 sm:p-2",
                  outside ? "opacity-40" : d.open ? "bg-muted/40" : "bg-muted/15",
                  d.date === today && "ring-2 ring-plum-500"
                )}
                style={!outside && d.bookings.length ? { backgroundColor: `color-mix(in srgb, var(--series-1) ${Math.round(6 + load * 22)}%, transparent)` } : undefined}
              >
                <span className="text-xs font-semibold tabular-nums sm:text-sm">{df(d.date, { day: "numeric" })}</span>
                {!outside && (
                  <span className="mt-auto hidden text-xs leading-tight sm:block">
                    {d.open ? (
                      d.bookings.length ? (
                        <>
                          <span className="block font-semibold">{f(m.count, { n: d.bookings.length })}</span>
                          {d.revenue > 0 && <span className="block text-muted-foreground">{money(d.revenue)}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">{m.closed}</span>
                    )}
                  </span>
                )}
                {!outside && d.bookings.length > 0 && <span className="mt-auto text-xs font-semibold tabular-nums sm:hidden">{d.bookings.length}</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
