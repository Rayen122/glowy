"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, ShoppingBag, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import type { CashierDay } from "@/modules/dashboard";
import { invoiceTotals } from "@/modules/dashboard/domain/invoice";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

type Method = "CASH" | "CARD" | "D17" | "CHEQUE";
type Line = { label: string; quantity: string; unitPrice: string };
type Ticket = { bookingId: string | null; client: string; lines: Line[]; deposit: number };

const METHODS: Method[] = ["CASH", "CARD", "D17", "CHEQUE"];
const toLines = (lines: Line[]) => lines.map((l) => ({ label: l.label, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }));

/** SAL-09 : rendez-vous du jour à encaisser + vente libre */
export function CashierQueue({ toCollect }: { toCollect: CashierDay["toCollect"] }) {
  const { t, money } = useI18n();
  const m = t.manage.cashier;
  const [ticket, setTicket] = useState<Ticket | null>(null);

  return (
    <section aria-labelledby="to-collect" className="rounded-3xl bg-card ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="to-collect" className="font-semibold">
          {m.toCollect} <span className="text-muted-foreground tabular-nums">({toCollect.length})</span>
        </h2>
        <button type="button" onClick={() => setTicket({ bookingId: null, client: "", lines: [{ label: "", quantity: "1", unitPrice: "" }], deposit: 0 })} className={cn(SECONDARY_BUTTON, "h-10 px-4")}>
          <ShoppingBag className="size-4" aria-hidden /> {m.walkIn}
        </button>
      </div>
      {toCollect.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">{m.toCollectEmpty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {toCollect.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="w-12 font-semibold tabular-nums" dir="ltr">
                {b.time}
              </span>
              <div className="min-w-40 flex-1">
                <p className="font-medium">{b.client}</p>
                <p className="text-xs text-muted-foreground">
                  {b.items.map((i) => i.label).join(" + ")} · {b.employee}
                </p>
              </div>
              <div className="text-end">
                <p className="font-semibold tabular-nums">{money(b.total)}</p>
                {b.deposit > 0 && (
                  <p className="text-xs text-success">
                    {m.depositPaid} : {money(b.deposit)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTicket({ bookingId: b.id, client: b.client, lines: b.items.map((i) => ({ label: i.label, quantity: "1", unitPrice: String(i.unitPrice) })), deposit: b.deposit })}
                className={cn(PRIMARY_BUTTON, "h-10 px-4")}
              >
                {m.collect}
              </button>
            </li>
          ))}
        </ul>
      )}
      {ticket && <CheckoutDialog key={ticket.bookingId ?? "walk-in"} ticket={ticket} onClose={() => setTicket(null)} />}
    </section>
  );
}

function CheckoutDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { t, f, money } = useI18n();
  const m = t.manage.cashier;
  const router = useRouter();
  const [client, setClient] = useState(ticket.client);
  const [lines, setLines] = useState<Line[]>(ticket.lines);
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<Method>("CASH");
  const { run, pending, error } = useAction();
  const totals = invoiceTotals(toLines(lines), Number(discount) || 0, ticket.deposit);
  const walkIn = ticket.bookingId === null;
  const setLine = (index: number, patch: Partial<Line>) => setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() =>
      api<{ id: string; number: string }>("/api/dashboard/cashier", {
        method: "POST",
        body: { bookingId: ticket.bookingId, clientName: walkIn ? client : undefined, lines: toLines(lines), discount: Number(discount) || 0, method },
      })
    );
    if (result) {
      onClose();
      router.push(`/dashboard/caisse/${result.id}`);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{walkIn ? m.walkIn : f(m.checkoutTitle, { client: ticket.client })}</DialogTitle>
          <DialogDescription>{walkIn ? m.walkInHint : m.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {walkIn && (
            <Field label={m.clientName}>
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={m.walkInClient} maxLength={80} required minLength={2} className={FIELD} />
            </Field>
          )}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">{m.lines}</legend>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_5.5rem_auto] items-center gap-2">
                <input aria-label={m.label} placeholder={m.label} value={line.label} onChange={(e) => setLine(i, { label: e.target.value })} maxLength={80} required className={FIELD} />
                <input aria-label={m.quantity} type="number" inputMode="numeric" min={1} max={99} value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className={cn(FIELD, "px-2 text-center")} />
                <input aria-label={m.unitPrice} type="number" inputMode="decimal" min={0} step="0.001" value={line.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} required className={cn(FIELD, "px-2")} />
                <button type="button" aria-label={m.removeLine} disabled={lines.length === 1} onClick={() => setLines((all) => all.filter((_, j) => j !== i))} className={ICON_BUTTON}>
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            <button type="button" disabled={lines.length >= 30} onClick={() => setLines((all) => [...all, { label: "", quantity: "1", unitPrice: "" }])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline">
              <Plus className="size-4" aria-hidden /> {m.addLine}
            </button>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.discount}>
              <input type="number" inputMode="decimal" min={0} step="0.5" value={discount} onChange={(e) => setDiscount(e.target.value)} className={FIELD} />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">{m.method}</legend>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((k) => (
                  <button key={k} type="button" aria-pressed={method === k} onClick={() => setMethod(k)} className={cn("h-10 rounded-full px-3.5 text-sm font-semibold ring-1", method === k ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}>
                    {m.methods[k]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <dl className="space-y-1.5 rounded-2xl bg-muted/50 p-4 text-sm">
            <div className="flex justify-between">
              <dt>{m.subtotal}</dt>
              <dd className="tabular-nums">{money(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt>{m.discount}</dt>
                <dd className="tabular-nums">− {money(totals.discount)}</dd>
              </div>
            )}
            {totals.deposit > 0 && (
              <div className="flex justify-between text-success">
                <dt>{m.depositPaid}</dt>
                <dd className="tabular-nums">− {money(totals.deposit)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <dt>{m.due}</dt>
              <dd className="tabular-nums">{money(totals.due)}</dd>
            </div>
          </dl>
          <FormError message={error} />
          <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, "w-full")}>
            {f(m.confirm, { amount: money(totals.due) })}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Annulation d'une facture par le gérant, avec motif obligatoire */
export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const { t } = useI18n();
  const m = t.manage.cashier;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(SECONDARY_BUTTON, "h-10 px-4 text-destructive print:hidden")}>
        <Ban className="size-4" aria-hidden /> {m.void}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api(`/api/dashboard/cashier/${invoiceId}`, { method: "DELETE", body: { reason } }), m.voidDone)) setOpen(false);
      }}
      className="flex w-full flex-wrap items-start gap-2 print:hidden sm:w-auto"
    >
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.voidReason} aria-label={m.voidReason} required minLength={3} maxLength={200} className={cn(FIELD, "h-10 min-w-0 flex-1 sm:w-64")} />
      <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-full bg-destructive px-4 text-sm font-semibold text-white disabled:opacity-60">
        {m.voidConfirm}
      </button>
      <button type="button" aria-label={t.manage.common.cancel} onClick={() => setOpen(false)} className={ICON_BUTTON}>
        <X className="size-4" aria-hidden />
      </button>
      {error && (
        <div className="w-full">
          <FormError message={error} />
        </div>
      )}
    </form>
  );
}
