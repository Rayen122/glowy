"use client";

import { useState } from "react";
import { BadgePercent, Gift, Pencil, Plus, Ticket, Timer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { PromotionRule, SalonReward } from "@/modules/promotions";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

type Kind = PromotionRule["kind"];
type Draft = {
  kind: Kind;
  code: string;
  label: string;
  valueType: "percent" | "amount";
  value: string;
  minTotal: string;
  startsOn: string;
  endsOn: string;
  withinHours: string;
  maxUses: string;
  active: boolean;
};

const EMPTY: Draft = { kind: "CODE", code: "", label: "", valueType: "percent", value: "10", minTotal: "0", startsOn: "", endsOn: "", withinHours: "3", maxUses: "", active: true };

const toDraft = (p: PromotionRule): Draft => ({
  kind: p.kind,
  code: p.code ?? "",
  label: p.label,
  valueType: p.percent != null ? "percent" : "amount",
  value: String(p.percent ?? p.amount ?? ""),
  minTotal: String(p.minTotal),
  startsOn: p.startsOn ?? "",
  endsOn: p.endsOn ?? "",
  withinHours: String(p.withinHours ?? 3),
  maxUses: p.maxUses != null ? String(p.maxUses) : "",
  active: p.active,
});

const toBody = (d: Draft) => ({
  kind: d.kind,
  code: d.kind === "CODE" ? d.code : null,
  label: d.label,
  percent: d.valueType === "percent" ? d.value : null,
  amount: d.valueType === "amount" ? d.value : null,
  minTotal: d.minTotal || 0,
  startsOn: d.startsOn || null,
  endsOn: d.endsOn || null,
  withinHours: d.kind === "LAST_MINUTE" ? d.withinHours : null,
  maxUses: d.maxUses || null,
  active: d.active,
});

/** SAL-10 : codes promo et offres de dernière minute */
export function PromotionsManager({ promotions }: { promotions: PromotionRule[] }) {
  const { t, f, money, df } = useI18n();
  const m = t.manage.promos;
  const [editing, setEditing] = useState<PromotionRule | "new" | null>(null);
  const { run } = useAction();
  const date = (iso: string) => df(iso, { day: "numeric", month: "short" });

  return (
    <section aria-labelledby="promos-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="promos-title" className="text-lg font-semibold">
          {m.promotions}
        </h2>
        <button type="button" onClick={() => setEditing("new")} className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden /> {m.add}
        </button>
      </div>
      {promotions.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.empty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {promotions.map((p) => {
            const Icon = p.kind === "CODE" ? Ticket : Timer;
            return (
              <li key={p.id} className={cn("flex gap-4 rounded-3xl bg-card p-5 ring-1 ring-border", !p.active && "opacity-60")}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-plum-50 text-plum-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{m.kinds[p.kind]}</span>
                    {p.code && (
                      <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white" dir="ltr">
                        {p.code}
                      </span>
                    )}
                    {!p.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{m.off}</span>}
                  </p>
                  <p className="font-semibold">{p.label}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-success">−{p.percent != null ? `${p.percent} %` : money(p.amount ?? 0)}</span>
                    {p.kind === "LAST_MINUTE" && ` · ${f(m.within, { n: p.withinHours ?? 0 })}`}
                    {p.minTotal > 0 && ` · ${f(m.min, { amount: money(p.minTotal) })}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.startsOn || p.endsOn ? f(m.period, { from: p.startsOn ? date(p.startsOn) : "…", to: p.endsOn ? date(p.endsOn) : "…" }) : m.always}
                    {" · "}
                    {p.maxUses != null ? f(m.usesOf, { n: p.uses, max: p.maxUses }) : f(m.uses, { n: p.uses })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button type="button" onClick={() => setEditing(p)} aria-label={`${t.manage.common.edit} — ${p.label}`} className={ICON_BUTTON}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <ConfirmDelete
                    compact
                    label={p.label}
                    onConfirm={() =>
                      run(async () => {
                        const result = await api<{ deleted: boolean }>(`/api/dashboard/promotions/${p.id}`, { method: "DELETE" });
                        toast.success(result.deleted ? t.manage.common.deleted : m.deactivated);
                      })
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <PromotionDialog key={editing === "new" ? "new" : editing.id} promotion={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function PromotionDialog({ promotion, onClose }: { promotion: PromotionRule | "new"; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.manage.promos;
  const isNew = promotion === "new";
  const [draft, setDraft] = useState<Draft>(isNew ? EMPTY : toDraft(promotion));
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const call = () => (isNew ? api("/api/dashboard/promotions", { method: "POST", body: toBody(draft) }) : api(`/api/dashboard/promotions/${promotion.id}`, { method: "PATCH", body: toBody(draft) }));
    if (await run(call, isNew ? t.manage.common.created : t.manage.common.saved)) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? m.addTitle : m.editTitle}</DialogTitle>
          <DialogDescription>{m.kindHint[draft.kind]}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div role="radiogroup" aria-label={m.promotions} className="grid grid-cols-2 gap-2">
            {(["CODE", "LAST_MINUTE"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={draft.kind === k} onClick={() => set("kind", k)} className={cn("h-11 rounded-xl text-sm font-semibold ring-1", draft.kind === k ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}>
                {m.kinds[k]}
              </button>
            ))}
          </div>
          {draft.kind === "CODE" && (
            <Field label={m.code}>
              <input value={draft.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required maxLength={20} placeholder="BIENVENUE10" dir="ltr" className={cn(FIELD, "uppercase")} />
            </Field>
          )}
          <Field label={m.label}>
            <input value={draft.label} onChange={(e) => set("label", e.target.value)} required maxLength={80} placeholder={m.labelPlaceholder} className={FIELD} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.valueType}>
              <select value={draft.valueType} onChange={(e) => set("valueType", e.target.value as Draft["valueType"])} className={FIELD}>
                <option value="percent">{m.percent}</option>
                <option value="amount">{m.amount}</option>
              </select>
            </Field>
            <Field label={draft.valueType === "percent" ? m.percentLabel : m.amountLabel}>
              <input type="number" inputMode="numeric" min={1} max={draft.valueType === "percent" ? 90 : 1000} value={draft.value} onChange={(e) => set("value", e.target.value)} required className={FIELD} />
            </Field>
            {draft.kind === "LAST_MINUTE" && (
              <Field label={m.withinHours}>
                <input type="number" inputMode="numeric" min={1} max={48} value={draft.withinHours} onChange={(e) => set("withinHours", e.target.value)} required className={FIELD} />
              </Field>
            )}
            <Field label={m.minTotal}>
              <input type="number" inputMode="numeric" min={0} value={draft.minTotal} onChange={(e) => set("minTotal", e.target.value)} className={FIELD} />
            </Field>
            <Field label={`${m.startsOn} (${t.manage.common.optional})`}>
              <input type="date" value={draft.startsOn} onChange={(e) => set("startsOn", e.target.value)} className={FIELD} />
            </Field>
            <Field label={`${m.endsOn} (${t.manage.common.optional})`}>
              <input type="date" value={draft.endsOn} onChange={(e) => set("endsOn", e.target.value)} className={FIELD} />
            </Field>
            <Field label={m.maxUses} className="col-span-2 sm:col-span-1">
              <input type="number" inputMode="numeric" min={1} value={draft.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder={m.unlimited} className={FIELD} />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
            {t.manage.common.active}
            <Switch checked={draft.active} onCheckedChange={(v) => set("active", v)} />
          </label>
          <FormError message={error} />
          <button type="submit" disabled={pending || draft.label.trim().length < 3 || !draft.value} className={cn(PRIMARY_BUTTON, "w-full")}>
            {pending ? t.manage.common.saving : t.manage.common.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** FID-06 : récompenses propres au salon + validation des codes au comptoir */
export function SalonRewardsManager({ rewards, canEdit }: { rewards: SalonReward[]; canEdit: boolean }) {
  const { t, f, nf } = useI18n();
  const m = t.manage.promos;
  const [label, setLabel] = useState("");
  const [cost, setCost] = useState("300");
  const { run, pending, error } = useAction();

  return (
    <section aria-labelledby="rewards-title" className="space-y-4">
      <div>
        <h2 id="rewards-title" className="text-lg font-semibold">
          {m.rewards}
        </h2>
        <p className="text-sm text-muted-foreground">{m.rewardsHint}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-3xl bg-card ring-1 ring-border">
          {rewards.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{m.rewardsEmpty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rewards.map((r) => (
                <li key={r.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3.5", !r.active && "opacity-60")}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gold-soft text-gold">
                    <Gift className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{f(m.redeemed, { n: r.redeemed, used: r.used })}</p>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {nf(r.cost)} {t.common.pts}
                  </span>
                  {canEdit && (
                    <>
                      <Switch
                        checked={r.active}
                        aria-label={t.manage.common.active}
                        onCheckedChange={(active) => run(() => api(`/api/dashboard/rewards/${r.id}`, { method: "PATCH", body: { label: r.label, cost: r.cost, active } }), t.manage.common.saved)}
                      />
                      <ConfirmDelete
                        compact
                        label={r.label}
                        onConfirm={() =>
                          run(async () => {
                            const result = await api<{ deleted: boolean }>(`/api/dashboard/rewards/${r.id}`, { method: "DELETE" });
                            toast.success(result.deleted ? t.manage.common.deleted : m.rewardDeactivated);
                          })
                        }
                      />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(() => api("/api/dashboard/rewards", { method: "POST", body: { label, cost, active: true } }), t.manage.common.created)) setLabel("");
              }}
              className="flex flex-wrap items-end gap-2 border-t border-border p-4"
            >
              <Field label={m.rewardLabel} className="min-w-48 flex-1">
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={m.rewardPlaceholder} maxLength={80} required className={FIELD} />
              </Field>
              <Field label={m.cost} className="w-32">
                <input type="number" inputMode="numeric" min={50} step={50} value={cost} onChange={(e) => setCost(e.target.value)} required className={FIELD} />
              </Field>
              <button type="submit" disabled={pending || label.trim().length < 3} className={PRIMARY_BUTTON}>
                <Plus className="size-4" aria-hidden /> {m.addReward}
              </button>
              {error && (
                <div className="w-full">
                  <FormError message={error} />
                </div>
              )}
            </form>
          )}
        </div>
        <RedemptionCheck />
      </div>
    </section>
  );
}

function RedemptionCheck() {
  const { t, f } = useI18n();
  const m = t.manage.promos;
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setResult(null);
        const done = await run(() => api<{ reward: string; client: string }>("/api/dashboard/redemptions", { method: "POST", body: { code } }));
        if (done) {
          setResult(f(m.validated, { reward: done.reward, client: done.client }));
          setCode("");
        }
      }}
      className="h-fit space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border"
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <BadgePercent className="size-4 text-plum-600" aria-hidden /> {m.validateTitle}
      </h3>
      <p className="text-sm text-muted-foreground">{m.validateHint}</p>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BH-XXXXXX" aria-label={m.validateTitle} maxLength={32} dir="ltr" className={cn(FIELD, "uppercase")} />
      <FormError message={error} />
      {result && (
        <p role="status" className="rounded-xl bg-success-soft p-3 text-sm font-medium text-success">
          {result}
        </p>
      )}
      <button type="submit" disabled={pending || code.trim().length < 4} className={cn(SECONDARY_BUTTON, "w-full")}>
        {m.validate}
      </button>
    </form>
  );
}
