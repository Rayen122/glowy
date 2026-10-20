"use client";

import { useState } from "react";
import { Pause, Play, Plus, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { CampaignRow, PointRuleRow } from "@/modules/loyalty";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

type Reason = PointRuleRow["reason"];

/** ADM-09 : barème des points Glowy, une ligne enregistrable par action */
export function PointRulesTable({ rules }: { rules: PointRuleRow[] }) {
  const { t } = useI18n();
  const m = t.manage.loyaltyAdmin;
  return (
    <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {[m.colAction, m.colPoints, m.colMonthly, m.colDaily, t.manage.common.active, ""].map((h, i) => (
              <th key={i} scope="col" className="px-4 py-3 text-start font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rules.map((rule) => (
            <RuleRow key={rule.reason} rule={rule} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow({ rule }: { rule: PointRuleRow }) {
  const { t } = useI18n();
  const m = t.manage.loyaltyAdmin;
  const [points, setPoints] = useState(String(rule.points));
  const [monthly, setMonthly] = useState(rule.monthlyCap != null ? String(rule.monthlyCap) : "");
  const [daily, setDaily] = useState(rule.dailyCap != null ? String(rule.dailyCap) : "");
  const [active, setActive] = useState(rule.active);
  const { run, pending, error } = useAction();
  const dirty = points !== String(rule.points) || monthly !== (rule.monthlyCap != null ? String(rule.monthlyCap) : "") || daily !== (rule.dailyCap != null ? String(rule.dailyCap) : "") || active !== rule.active;
  const label = m.reasons[rule.reason as keyof typeof m.reasons] ?? rule.reason;

  return (
    <tr className={cn(!active && "text-muted-foreground")}>
      <th scope="row" className="px-4 py-2.5 text-start font-medium">
        {label}
        {error && <span className="block text-xs font-normal text-destructive">{error}</span>}
      </th>
      <td className="px-4 py-2.5">
        <input type="number" inputMode="numeric" aria-label={`${m.colPoints} — ${label}`} value={points} onChange={(e) => setPoints(e.target.value)} className={cn(FIELD, "h-9 w-20 px-2 tabular-nums")} />
      </td>
      <td className="px-4 py-2.5">
        <input type="number" inputMode="numeric" min={1} aria-label={`${m.colMonthly} — ${label}`} placeholder={m.none} value={monthly} onChange={(e) => setMonthly(e.target.value)} className={cn(FIELD, "h-9 w-20 px-2 tabular-nums")} />
      </td>
      <td className="px-4 py-2.5">
        <input type="number" inputMode="numeric" min={1} aria-label={`${m.colDaily} — ${label}`} placeholder={String(rule.defaultDailyCap)} value={daily} onChange={(e) => setDaily(e.target.value)} className={cn(FIELD, "h-9 w-20 px-2 tabular-nums")} />
      </td>
      <td className="px-4 py-2.5">
        <Switch checked={active} onCheckedChange={setActive} aria-label={`${t.manage.common.active} — ${label}`} />
      </td>
      <td className="px-4 py-2.5 text-end">
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() =>
            run(
              () => api(`/api/admin/loyalty/rules/${rule.reason}`, { method: "PATCH", body: { points, active, monthlyCap: monthly || null, dailyCap: daily || null } }),
              t.manage.common.saved
            )
          }
          className={cn(SECONDARY_BUTTON, "h-9 px-3.5 text-xs")}
        >
          {m.saveRow}
        </button>
      </td>
    </tr>
  );
}

const STATUS_STYLE = { running: "bg-success-soft text-success", scheduled: "bg-plum-50 text-plum-800", ended: "bg-muted text-muted-foreground", off: "bg-sand text-plum-800" } as const;

/** ADM-09 : campagnes « double points » */
export function CampaignsManager({ campaigns, reasons }: { campaigns: CampaignRow[]; reasons: Reason[] }) {
  const { t, f, df, nf } = useI18n();
  const m = t.manage.loyaltyAdmin;
  const [open, setOpen] = useState(false);
  const { run } = useAction();
  const date = (iso: string) => df(iso, { day: "numeric", month: "short", year: "numeric" });

  return (
    <section aria-labelledby="campaigns-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="campaigns-title" className="text-lg font-semibold">
          {m.campaignsTitle}
        </h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON}>
            <Plus className="size-4" aria-hidden /> {m.addCampaign}
          </button>
        )}
      </div>
      {open && <CampaignForm reasons={reasons} onDone={() => setOpen(false)} />}
      {campaigns.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{m.campaignsEmpty}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <li key={c.id} className="flex gap-4 rounded-3xl bg-card p-5 ring-1 ring-border">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gold-soft text-base font-bold text-gold">×{nf(c.multiplier)}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[c.status])}>{m.statuses[c.status]}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {date(c.startsOn)} → {date(c.endsOn)}
                </p>
                <p className="text-xs text-muted-foreground">{c.reasons.length ? f(m.someActions, { n: c.reasons.length }) : m.allActions}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.status !== "ended" && (
                  <button
                    type="button"
                    aria-label={`${c.active ? m.pause : m.resume} — ${c.label}`}
                    onClick={() => run(() => api(`/api/admin/loyalty/campaigns/${c.id}`, { method: "PATCH", body: { active: !c.active } }), t.manage.common.saved)}
                    className={ICON_BUTTON}
                  >
                    {c.active ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                  </button>
                )}
                <ConfirmDelete compact label={c.label} onConfirm={() => run(() => api(`/api/admin/loyalty/campaigns/${c.id}`, { method: "DELETE" }), t.manage.common.deleted)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CampaignForm({ reasons, onDone }: { reasons: Reason[]; onDone: () => void }) {
  const { t } = useI18n();
  const m = t.manage.loyaltyAdmin;
  const [label, setLabel] = useState("");
  const [multiplier, setMultiplier] = useState("2");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [chosen, setChosen] = useState<Reason[]>([]);
  const { run, pending, error } = useAction();
  const earning = reasons.filter((r) => r !== "NO_SHOW");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api("/api/admin/loyalty/campaigns", { method: "POST", body: { label, multiplier, startsOn, endsOn, reasons: chosen, active: true } }), t.manage.common.created)) onDone();
      }}
      className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-border"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={m.campaignLabel} className="sm:col-span-2 lg:col-span-1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={m.campaignPlaceholder} maxLength={80} required className={FIELD} />
        </Field>
        <Field label={m.multiplier}>
          <select value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={FIELD}>
            {["1.5", "2", "3"].map((x) => (
              <option key={x} value={x}>
                ×{x.replace(".", ",")}
              </option>
            ))}
          </select>
        </Field>
        <Field label={m.startsOn}>
          <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required className={FIELD} />
        </Field>
        <Field label={m.endsOn}>
          <input type="date" value={endsOn} min={startsOn || undefined} onChange={(e) => setEndsOn(e.target.value)} required className={FIELD} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{m.chooseActions}</legend>
        <div className="flex flex-wrap gap-2">
          {earning.map((r) => {
            const on = chosen.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => setChosen((all) => (on ? all.filter((x) => x !== r) : [...all, r]))}
                className={cn("h-9 rounded-full px-3 text-xs font-semibold ring-1", on ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
              >
                {m.reasons[r as keyof typeof m.reasons]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <FormError message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || label.trim().length < 3 || !startsOn || !endsOn} className={PRIMARY_BUTTON}>
          <Zap className="size-4" aria-hidden /> {m.addCampaign}
        </button>
        <button type="button" onClick={onDone} className={SECONDARY_BUTTON}>
          {t.manage.common.cancel}
        </button>
      </div>
    </form>
  );
}
