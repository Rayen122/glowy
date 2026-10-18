"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Send } from "lucide-react";
import { toast } from "sonner";
import { PAID_PLANS, PLAN_PAYMENT_CHANNELS, PLAN_PRICES, type PaidPlan, type PlanPaymentChannel } from "@/core/domain/enums";
import { useI18n } from "@/i18n/client";
import { ApiError, api } from "@/lib/api";
import { PLANS } from "@/lib/data";
import { cn } from "@/lib/utils";

const FIELD = "h-11 w-full rounded-xl border border-border bg-card px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

/** Le gérant choisit un plan, déclare son paiement (mode + référence) ; le Super Admin le valide ensuite (ADM-05) */
export function PlanRequestForm({ currentPlan }: { currentPlan: string }) {
  const { t, tc, f, nf } = useI18n();
  const s = t.subscription;
  const router = useRouter();
  const [plan, setPlan] = useState<PaidPlan>("pro");
  const [channel, setChannel] = useState<PlanPaymentChannel>("VIREMENT");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api("/api/subscriptions", { method: "POST", body: { plan, channel, reference, note: note || undefined } });
      toast.success(s.sent, { description: s.sentDesc });
      setReference("");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? (e.details?.[0]?.message ?? e.message) : t.errors.generic);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium">{s.planLabel}</legend>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PLANS.filter((p) => (PAID_PLANS as readonly string[]).includes(p.id)).map((p) => {
            const selected = plan === p.id;
            return (
              <label
                key={p.id}
                className={cn("cursor-pointer rounded-2xl border bg-card p-4 transition-colors", selected ? "border-primary ring-3 ring-ring/20" : "border-border hover:border-plum-300")}
              >
                <input type="radio" name="plan" value={p.id} checked={selected} onChange={() => setPlan(p.id as PaidPlan)} className="sr-only" />
                <span className="flex items-start justify-between gap-2">
                  <span className="text-base font-semibold">{tc(p.name)}</span>
                  {currentPlan === p.id && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">{s.currentBadge}</span>}
                </span>
                <span className="mt-1 block text-2xl font-bold">
                  {nf(PLAN_PRICES[p.id as PaidPlan])} <span className="text-sm font-medium text-muted-foreground">{s.perMonth}</span>
                </span>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {p.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                      {tc(feature)}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="rounded-2xl bg-sand/70 p-3.5 text-sm text-muted-foreground">{f(s.payHint, { amount: nf(PLAN_PRICES[plan]) })}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          {s.channelLabel}
          <select value={channel} onChange={(e) => setChannel(e.target.value as PlanPaymentChannel)} className={cn(FIELD, "mt-1.5")}>
            {PLAN_PAYMENT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {s.channels[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {s.referenceLabel}
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={s.referencePlaceholder}
            required
            minLength={3}
            maxLength={60}
            dir="ltr"
            className={cn(FIELD, "mt-1.5")}
          />
        </label>
      </div>
      <label className="block text-sm font-medium">
        {s.noteLabel}
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={cn(FIELD, "mt-1.5")} />
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || reference.trim().length < 3}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800 disabled:opacity-60"
      >
        <Send className="size-4 rtl:rotate-180" aria-hidden />
        {sending ? s.sending : s.submit}
      </button>
    </form>
  );
}
