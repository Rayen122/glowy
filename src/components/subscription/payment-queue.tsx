"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { AdminPaymentRow } from "@/modules/subscription";

/** Paiements d'abonnement à valider (ADM-05) : accepter active le plan 30 jours, refuser demande un motif */
export function PaymentQueue({ initial, nowMs }: { initial: readonly AdminPaymentRow[]; nowMs: number }) {
  const { t, tc, f, nf, ago } = useI18n();
  const s = t.subscription;
  const router = useRouter();
  const [rows, setRows] = useState([...initial]);
  const [busy, setBusy] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function decide(row: AdminPaymentRow, body: { action: "accept" } | { action: "refuse"; reason: string }) {
    setBusy(row.id);
    try {
      await api(`/api/admin/payments/${row.id}`, { method: "PATCH", body });
      setRows((r) => r.filter((x) => x.id !== row.id));
      if (body.action === "accept") toast.success(f(s.accepted, { name: row.salon.name }), { description: f(s.acceptedDesc, { plan: t.admin.plans[row.plan] }) });
      else toast(f(s.refused, { name: row.salon.name }), { description: s.refusedDesc });
      setRefusing(null);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  if (!rows.length) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft p-6 text-sm font-medium text-success">
        <ShieldCheck className="size-4" aria-hidden /> {s.noPending}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {r.salon.name} <span className="font-normal text-muted-foreground">· {tc(r.salon.city)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {r.owner.name} · {r.owner.email} · {ago(Math.max(0, Math.round((nowMs - new Date(r.createdAt).getTime()) / 60_000)))}
              </p>
              <p className="mt-1.5 text-sm">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{t.admin.plans[r.plan]}</span>{" "}
                <span className="font-semibold">{nf(r.amount)} DT</span> · {s.channels[r.channel]} ·{" "}
                {r.reference ? <span dir="ltr" className="font-mono text-xs">{r.reference}</span> : <span className="text-muted-foreground">{s.noReference}</span>}
              </p>
              {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
            </div>
            {refusing !== r.id && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    setRefusing(r.id);
                    setReason("");
                  }}
                  className="inline-flex h-10 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:bg-danger-soft hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden /> {s.refuse}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void decide(r, { action: "accept" })}
                  className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-plum-800"
                >
                  <Check className="size-3.5" aria-hidden /> {s.accept}
                </button>
              </div>
            )}
          </div>
          {refusing === r.id && (
            <div className="mt-3 space-y-2 rounded-2xl bg-sand/70 p-3">
              <label className="block text-sm font-medium">
                {s.reasonLabel}
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} autoFocus className="mt-1.5 h-11 w-full rounded-xl border border-border bg-card px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none" />
              </label>
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => setRefusing(null)} className="inline-flex h-10 items-center rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted">
                  {s.cancel}
                </button>
                <button
                  type="button"
                  disabled={busy !== null || reason.trim().length < 3}
                  onClick={() => void decide(r, { action: "refuse", reason: reason.trim() })}
                  className="inline-flex h-10 items-center gap-1 rounded-full bg-destructive px-3 text-xs font-semibold text-white disabled:opacity-60"
                >
                  <X className="size-3.5" aria-hidden /> {s.confirmRefuse}
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
