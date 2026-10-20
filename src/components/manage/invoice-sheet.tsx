import { getI18n } from "@/i18n/server";
import { utcToTunis } from "@/core/domain/time";
import type { InvoiceDetail } from "@/modules/dashboard";
import { cn } from "@/lib/utils";

/** SAL-09 : facture imprimable (Imprimer / Enregistrer en PDF depuis le navigateur) */
export async function InvoiceSheet({ invoice }: { invoice: InvoiceDetail }) {
  const { t, f, money, nf, df } = await getI18n();
  const m = t.manage.cashier;
  const issued = utcToTunis(invoice.issuedAt);
  const dateLong = (iso: string) => df(iso, { day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="mx-auto max-w-2xl rounded-3xl bg-card p-6 ring-1 ring-border sm:p-10 print:max-w-none print:rounded-none print:p-0 print:ring-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="display text-2xl text-ink">{invoice.salon.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.salon.address}
            {!invoice.salon.address.includes(invoice.salon.city) && `, ${invoice.salon.city}`}
          </p>
          {invoice.salon.phone && (
            <p className="text-sm text-muted-foreground" dir="ltr">
              {invoice.salon.phone}
            </p>
          )}
        </div>
        <div className="text-end">
          <h1 className="text-lg font-semibold">{f(m.invoiceOf, { number: invoice.number })}</h1>
          <p className="text-sm text-muted-foreground">{f(m.issuedOn, { date: dateLong(issued.date), time: issued.time })}</p>
          {invoice.issuedBy && <p className="text-sm text-muted-foreground">{f(m.issuedBy, { name: invoice.issuedBy })}</p>}
        </div>
      </header>

      {invoice.status === "VOID" && (
        <p role="status" className="mt-6 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-destructive">
          {f(m.voidedBanner, { date: invoice.voidedAt ? dateLong(utcToTunis(invoice.voidedAt).date) : "", reason: invoice.voidReason ?? "" })}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.billedTo}</h2>
        <p className="mt-1 font-semibold">{invoice.client.name}</p>
        {invoice.client.email && <p className="text-sm text-muted-foreground">{invoice.client.email}</p>}
        {invoice.client.phone && (
          <p className="text-sm text-muted-foreground" dir="ltr">
            {invoice.client.phone}
          </p>
        )}
      </section>

      <div className="no-scrollbar mt-6 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-2 text-start font-medium">{m.label}</th>
              <th scope="col" className="py-2 text-end font-medium">{m.quantity}</th>
              <th scope="col" className="py-2 text-end font-medium">{m.unitPrice}</th>
              <th scope="col" className="py-2 text-end font-medium">{m.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2.5">{l.label}</td>
                <td className="py-2.5 text-end tabular-nums">{nf(l.quantity)}</td>
                <td className="py-2.5 text-end tabular-nums">{nf(l.unitPrice)}</td>
                <td className="py-2.5 text-end font-medium tabular-nums">{money(l.quantity * l.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="ms-auto mt-6 max-w-xs space-y-1.5 text-sm">
        <div className="flex justify-between gap-6">
          <dt>{m.subtotal}</dt>
          <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
        </div>
        {invoice.discount > 0 && (
          <div className="flex justify-between gap-6">
            <dt>{m.discount}</dt>
            <dd className="tabular-nums">− {money(invoice.discount)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-6 font-semibold">
          <dt>{m.total}</dt>
          <dd className="tabular-nums">{money(invoice.total)}</dd>
        </div>
        {invoice.deposit > 0 && (
          <div className="flex justify-between gap-6 text-success">
            <dt>{m.depositPaid}</dt>
            <dd className="tabular-nums">− {money(invoice.deposit)}</dd>
          </div>
        )}
        <div className={cn("flex justify-between gap-6 border-t border-border pt-2 text-base font-semibold", invoice.status === "VOID" && "line-through")}>
          <dt>{f(m.paidWith, { method: m.methods[invoice.method] })}</dt>
          <dd className="tabular-nums">{money(invoice.due)}</dd>
        </div>
      </dl>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{m.thanks}</p>
        <p className="mt-1">{m.legal}</p>
      </footer>
    </article>
  );
}
