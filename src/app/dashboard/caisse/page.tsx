import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CashierQueue } from "@/components/manage/cashier";
import { ManageHeader } from "@/components/manage/kit";
import { addDays, tunisToday } from "@/core/domain/time";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { cashierDay, staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.cashier.title };
}

/** SAL-09 : caisse du jour */
export default async function CashierPage({ searchParams }: PageProps<"/dashboard/caisse">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const asked = (await searchParams).date;
  const today = tunisToday();
  const date = typeof asked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;
  const salon = await staffSalon(user);
  const [{ t, money, nf, df }, day] = await Promise.all([getI18n(), cashierDay(salon.id, date)]);
  const m = t.manage.cashier;
  const tiles = [
    [m.collected, money(day.totals.collected)],
    [m.deposits, money(day.totals.deposits)],
    [m.revenue, money(day.totals.revenue)],
    [m.invoicesCount, nf(day.totals.count)],
  ];

  return (
    <div className="space-y-5">
      <ManageHeader title={m.title} description={m.description} />
      <nav aria-label={m.title} className="flex flex-wrap items-center gap-2">
        <Link href={`?date=${addDays(date, -1)}`} aria-label={m.prevDay} className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-border hover:bg-muted">
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
        <p className="min-w-44 text-center font-semibold capitalize">{df(date, { weekday: "long", day: "numeric", month: "long" })}</p>
        <Link href={`?date=${addDays(date, 1)}`} aria-label={m.nextDay} className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-border hover:bg-muted">
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
        {date !== today && (
          <Link href="/dashboard/caisse" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-border hover:bg-muted">
            {m.today}
          </Link>
        )}
      </nav>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-card p-4 ring-1 ring-border">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {(Object.keys(day.totals.byMethod) as (keyof typeof day.totals.byMethod)[]).map((k) => (
          <span key={k}>
            {m.methods[k]} : <span className="font-semibold text-foreground tabular-nums">{money(day.totals.byMethod[k])}</span>
          </span>
        ))}
      </p>
      <CashierQueue toCollect={day.toCollect} />
      <section aria-labelledby="journal" className="rounded-3xl bg-card ring-1 ring-border">
        <h2 id="journal" className="border-b border-border px-5 py-3 font-semibold">
          {m.journal}
        </h2>
        <div className="no-scrollbar overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {[m.colNumber, m.colTime, m.colClient, m.colMethod, m.colTotal].map((h) => (
                  <th key={h} scope="col" className="px-5 py-2.5 text-start font-medium last:text-end">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {day.invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    {m.journalEmpty}
                  </td>
                </tr>
              )}
              {day.invoices.map((i) => (
                <tr key={i.id} className={cn("hover:bg-muted/40", i.status === "VOID" && "text-muted-foreground")}>
                  <td className="px-5 py-3">
                    <Link href={`/dashboard/caisse/${i.id}`} className="font-semibold hover:underline" dir="ltr">
                      {i.number}
                    </Link>
                    {i.status === "VOID" && <span className="ms-2 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-destructive">{m.voided}</span>}
                  </td>
                  <td className="px-5 py-3 tabular-nums" dir="ltr">
                    {i.time}
                  </td>
                  <td className="px-5 py-3">{i.client}</td>
                  <td className="px-5 py-3">{m.methods[i.method]}</td>
                  <td className={cn("px-5 py-3 text-end font-semibold tabular-nums", i.status === "VOID" && "line-through")}>{money(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
