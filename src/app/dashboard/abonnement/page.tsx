import type { Metadata } from "next";
import { CircleCheck, Clock, Hourglass } from "lucide-react";
import { PlanRequestForm } from "@/components/subscription/plan-request-form";
import { utcToTunis } from "@/core/domain/time";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { staffSalon } from "@/modules/dashboard";
import { salonSubscription } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.subscription.metaTitle };
}

const STATUS_STYLE = { PENDING: "bg-sand text-plum-800", ACCEPTED: "bg-success-soft text-success", REFUSED: "bg-danger-soft text-destructive" } as const;

export default async function SubscriptionPage() {
  const user = await requirePageUser("MANAGER");
  const salon = await staffSalon(user);
  const [{ t, f, nf, df, ago }, sub] = await Promise.all([getI18n(), salonSubscription(salon.id)]);
  const s = t.subscription;
  const paid = sub.plan !== "gratuit";
  const date = (d: Date) => df(utcToTunis(d).date, { day: "numeric", month: "long", year: "numeric" });
  const minutesAgo = (d: Date) => Math.max(0, Math.round((sub.nowMs - d.getTime()) / 60_000));

  return (
    <div className="space-y-6">
      <header>
        <h1 data-animate="split" className="display text-3xl text-ink sm:text-4xl">
          {s.metaTitle}
        </h1>
      </header>

      <section aria-labelledby="current-title" className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
        <h2 id="current-title" className="text-sm font-medium text-muted-foreground">
          {s.currentPlan}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">{t.admin.plans[sub.plan]}</span>
          {paid && sub.planUntil ? (
            <p className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {f(s.activeUntil, { date: date(sub.planUntil) })} ·{" "}
              <span className={cn("font-semibold", sub.daysLeft <= 7 ? "text-destructive" : "text-success")}>{sub.daysLeft > 0 ? f(s.daysLeft, { n: sub.daysLeft }) : s.expired}</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{s.freePlan}</p>
          )}
        </div>
      </section>

      {sub.pending ? (
        <section aria-labelledby="pending-title" className="rounded-3xl bg-sand/70 p-5 ring-1 ring-border sm:p-6">
          <h2 id="pending-title" className="flex items-center gap-2 font-semibold">
            <Hourglass className="size-4" aria-hidden /> {s.pendingTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{f(s.pendingText, { plan: t.admin.plans[sub.pending.plan], amount: nf(sub.pending.amount), ago: ago(minutesAgo(sub.pending.createdAt)) })}</p>
        </section>
      ) : (
        <section aria-labelledby="pay-title" className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
          <h2 id="pay-title" className="mb-4 text-lg font-semibold">
            {s.payTitle}
          </h2>
          <PlanRequestForm currentPlan={sub.plan} />
        </section>
      )}

      <section aria-labelledby="history-title" className="rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
        <h2 id="history-title" className="mb-3 text-lg font-semibold">
          {s.historyTitle}
        </h2>
        {sub.payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{s.noPayments}</p>
        ) : (
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {[s.colDate, s.colPlan, s.colAmount, s.colChannel, s.colReference, s.colStatus].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium first:ps-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sub.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-3 first:ps-0">{date(p.createdAt)}</td>
                    <td className="px-3 py-3">{t.admin.plans[p.plan]}</td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">{nf(p.amount)} DT</td>
                    <td className="px-3 py-3">{s.channels[p.channel]}</td>
                    <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[p.status])}>
                        {p.status === "ACCEPTED" && <CircleCheck className="size-3" aria-hidden />}
                        {s.status[p.status]}
                      </span>
                      {p.reason && <p className="mt-1 text-xs text-muted-foreground">{f(s.reason, { reason: p.reason })}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
