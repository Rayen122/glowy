import type { Metadata } from "next";
import { PaymentQueue } from "@/components/subscription/payment-queue";
import { utcToTunis } from "@/core/domain/time";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { commissionsReport } from "@/modules/platform";
import { adminSubscriptions } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.subscription.adminTitle };
}

const STATUS_STYLE = { PENDING: "bg-sand text-plum-800", ACCEPTED: "bg-success-soft text-success", REFUSED: "bg-danger-soft text-destructive" } as const;

export default async function AdminSubscriptionsPage() {
  await requirePageUser("ADMIN");
  const [{ t, tc, f, nf, df }, data, commissions] = await Promise.all([getI18n(), adminSubscriptions(), commissionsReport(30)]);
  const pm = t.manage.platform;
  const s = t.subscription;
  const kpis = [
    { label: s.revenue30d, value: `${nf(data.revenue30d)} DT` },
    { label: s.recurring, value: `${nf(data.monthlyRecurring)} DT` },
    { label: s.activePro, value: nf(data.activePlans.pro) },
    { label: s.activePremium, value: nf(data.activePlans.premium) },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 data-animate="split" className="display text-3xl text-ink sm:text-4xl">
          {s.adminTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{s.adminSubtitle}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-5">
            <dt className="text-xs font-medium text-muted-foreground">{k.label}</dt>
            <dd className="mt-1 text-2xl font-bold">{k.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="queue-title" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6">
        <h2 id="queue-title" className="mb-2 text-lg font-semibold">
          {s.pendingAdminTitle} {data.pending.length > 0 && <span className="ms-1 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{data.pending.length}</span>}
        </h2>
        <PaymentQueue initial={data.pending} nowMs={data.nowMs} />
      </section>

      <section aria-labelledby="history-title" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6">
        <h2 id="history-title" className="mb-3 text-lg font-semibold">
          {s.lastDecisions}
        </h2>
        {data.history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{s.noPayments}</p>
        ) : (
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {[s.colSalon, s.colPlan, s.colAmount, s.colChannel, s.colReference, s.colStatus].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium first:ps-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.history.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-3 first:ps-0">
                      <p className="font-semibold">{p.salon.name}</p>
                      <p className="text-xs text-muted-foreground">{tc(p.salon.city)} · {p.decidedAt ? df(utcToTunis(p.decidedAt).date, { day: "numeric", month: "short" }) : ""}</p>
                    </td>
                    <td className="px-3 py-3">{t.admin.plans[p.plan]}</td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">{nf(p.amount)} DT</td>
                    <td className="px-3 py-3">{s.channels[p.channel]}</td>
                    <td className="px-3 py-3 font-mono text-xs" dir="ltr">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[p.status])}>{s.status[p.status]}</span>
                      {p.reason && <p className="mt-1 text-xs text-muted-foreground">{f(s.reason, { reason: p.reason })}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ADM-05 : commissions Glowy sur les acomptes payés en ligne (taux réglables dans Paramètres) */}
      <section aria-labelledby="commissions-title" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="commissions-title" className="text-lg font-semibold">
            {pm.commissionsTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {pm.depositsTotal} : <span className="font-semibold text-foreground">{nf(commissions.deposits)} DT</span> · {pm.commissionsTotal} :{" "}
            <span className="font-semibold text-foreground">{nf(commissions.total)} DT</span>
          </p>
        </div>
        {commissions.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{pm.noCommissions}</p>
        ) : (
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {[pm.colSalon, pm.colPlan, pm.colRate, pm.colDeposits, pm.colCommission].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 text-start font-medium first:ps-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.rows.map((r) => (
                  <tr key={r.salon}>
                    <td className="px-3 py-3 first:ps-0">
                      <p className="font-semibold">{r.salon}</p>
                      <p className="text-xs text-muted-foreground">{tc(r.city)}</p>
                    </td>
                    <td className="px-3 py-3">{t.admin.plans[r.plan]}</td>
                    <td className="px-3 py-3 tabular-nums">{nf(r.rate)} %</td>
                    <td className="px-3 py-3 tabular-nums">{nf(r.deposits)} DT</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{nf(r.commission)} DT</td>
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
