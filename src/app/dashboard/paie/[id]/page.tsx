import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/manage/kit";
import { getI18n } from "@/i18n/server";
import { requirePageUser } from "@/infrastructure/session";
import { cn } from "@/lib/utils";
import { payslipFor } from "@/modules/payroll";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.payroll.doc.title };
}

/** Bulletin de paie : visible par le gérant du salon, ou par le professionnel une fois validé ; imprimable (PDF) */
export default async function PayslipPage({ params }: PageProps<"/dashboard/paie/[id]">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { id } = await params;
  const [{ t, f, nf, df, dur }, slip] = await Promise.all([getI18n(), payslipFor(user, id)]);
  const p = t.manage.payroll;
  const d = p.doc;
  const dt = (n: number) => `${nf(n, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${t.common.currency}`;
  const l = slip.lines;
  const s = slip.summary;
  const month = df(`${slip.period}-15`, { month: "long", year: "numeric" });
  const rows: { label: string; amount: number; sign: "+" | "−" | "="; strong?: boolean; hidden?: boolean }[] = [
    { label: d.base, amount: slip.baseSalary, sign: "+" },
    { label: f(d.absences, { n: s.absentDays }), amount: l.absenceDeduction, sign: "−", hidden: !l.absenceDeduction },
    { label: f(d.overtimeLine, { h: nf(Math.round((s.overtimeMinutes / 60) * 100) / 100), rate: slip.overtimeRate }), amount: l.overtimePay, sign: "+", hidden: !l.overtimePay },
    { label: f(d.commissionLine, { rate: slip.commissionRate, revenue: dt(slip.revenue) }), amount: l.commission, sign: "+", hidden: !l.commission },
    { label: d.bonusLine, amount: l.bonus, sign: "+", hidden: !l.bonus },
    { label: d.grossLine, amount: l.gross, sign: "=", strong: true },
    { label: f(d.cnssLine, { rate: slip.rates.cnssRate }), amount: l.cnss, sign: "−" },
    { label: d.irppLine, amount: l.irpp, sign: "−", hidden: !slip.rates.irpp },
    { label: f(d.cssLine, { rate: slip.rates.cssRate }), amount: l.css, sign: "−", hidden: !slip.rates.irpp },
    { label: d.advanceLine, amount: l.advance, sign: "−", hidden: !l.advance },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/dashboard/paie" className="inline-flex items-center gap-1 text-sm font-semibold text-plum-700 hover:underline">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {user.role === "EMPLOYEE" ? p.myTitle : p.title}
        </Link>
        <PrintButton label={p.print} />
      </div>
      <article className="rounded-3xl bg-card p-6 ring-1 ring-border sm:p-8 print:rounded-none print:p-0 print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="eyebrow">{d.title}</p>
            <h1 className="display mt-1 text-3xl capitalize text-ink">{month}</h1>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", slip.status === "VALIDATED" ? "bg-success/10 text-success" : "bg-warning/15 text-plum-800")}>
            {slip.status === "VALIDATED" ? (slip.validatedAt ? f(d.validatedOn, { date: df(slip.validatedAt, { day: "numeric", month: "long", year: "numeric" }) }) : p.validated) : p.draft}
          </span>
        </header>
        <dl className="grid gap-4 border-b border-border py-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{d.employer}</dt>
            <dd className="mt-1 font-semibold">{slip.salon.name}</dd>
            <dd className="text-muted-foreground">{slip.salon.address}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{d.employee}</dt>
            <dd className="mt-1 font-semibold">{slip.employeeName}</dd>
            <dd className="text-muted-foreground">{slip.employeeTitle}</dd>
          </div>
        </dl>
        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows
              .filter((r) => !r.hidden)
              .map((r) => (
                <tr key={r.label} className={cn(r.strong && "font-semibold")}>
                  <td className="py-2.5">{r.label}</td>
                  <td className={cn("py-2.5 text-end tabular-nums", r.sign === "−" && "text-destructive")} dir="ltr">
                    {r.sign === "=" ? "" : r.sign} {dt(r.amount)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-4 flex items-center justify-between rounded-2xl bg-blush p-4 text-lg font-semibold">
          <span>{d.netLine}</span>
          <span className="tabular-nums" dir="ltr">
            {dt(l.net)}
          </span>
        </p>
        <section className="mt-6">
          <h2 className="text-sm font-semibold">{d.attendance}</h2>
          <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <li className="rounded-xl bg-muted/60 p-3">
              <span className="block text-xs text-muted-foreground">{p.summary.workedDays}</span>
              <span className="font-semibold tabular-nums">{s.workedDays}</span>
            </li>
            <li className="rounded-xl bg-muted/60 p-3">
              <span className="block text-xs text-muted-foreground">{p.summary.absentDays}</span>
              <span className="font-semibold tabular-nums">{s.absentDays}</span>
            </li>
            <li className="rounded-xl bg-muted/60 p-3">
              <span className="block text-xs text-muted-foreground">{p.summary.leaveDays}</span>
              <span className="font-semibold tabular-nums">{s.leaveDays}</span>
            </li>
            <li className="rounded-xl bg-muted/60 p-3">
              <span className="block text-xs text-muted-foreground">{p.summary.hours}</span>
              <span className="font-semibold tabular-nums">{dur(s.workedMinutes)}</span>
            </li>
          </ul>
        </section>
        {slip.note && <p className="mt-4 text-sm">{slip.note}</p>}
        <p className="mt-6 text-xs text-muted-foreground">{d.indicative}</p>
        {slip.status === "DRAFT" && <p className="mt-1 text-xs font-semibold text-plum-800">{d.draftNotice}</p>}
      </article>
    </div>
  );
}
