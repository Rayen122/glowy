"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import type { Branch } from "@/modules/dashboard";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

const STATUS_STYLE = { ACTIVE: "bg-success-soft text-success", PENDING: "bg-sand text-plum-800", SUSPENDED: "bg-danger-soft text-destructive", REJECTED: "bg-muted text-muted-foreground" } as const;

/** SAL-14 : succursales du gérant, salon piloté et ouverture d'une nouvelle succursale */
export function BranchesManager({ branches }: { branches: Branch[] }) {
  const { t, f, tc, nf, money } = useI18n();
  const m = t.manage.branches;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", phone: "" });
  const { run, pending, error } = useAction();
  const switching = useAction();
  const totals = branches.reduce((a, b) => ({ today: a.today + b.today, revenue: a.revenue + b.revenue30d, team: a.team + b.team }), { today: 0, revenue: 0, team: 0 });

  async function manage(branch: Branch) {
    if (await switching.run(() => api("/api/dashboard/branches/switch", { method: "POST", body: { salonId: branch.id } }))) {
      toast.success(f(m.switched, { name: branch.name }));
      router.push("/dashboard");
    }
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 gap-3 rounded-3xl bg-card p-4 ring-1 ring-border sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">
            {m.total} · {m.today}
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{nf(totals.today)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{m.revenue}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(totals.revenue)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{m.team}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{nf(totals.team)}</dd>
        </div>
      </dl>

      <ul className="grid gap-3 md:grid-cols-2">
        {branches.map((b) => (
          <li key={b.id} className={cn("flex flex-col gap-4 rounded-3xl bg-card p-5 ring-1", b.current ? "ring-2 ring-plum-400" : "ring-border")}>
            <div className="flex items-start gap-3">
              <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted text-plum-700">
                {b.coverUrl ? <Image src={b.coverUrl} alt="" fill sizes="48px" className="object-cover" /> : <Building2 className="size-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.name}</p>
                <p className="text-sm text-muted-foreground">
                  {tc(b.city)} · {t.admin.plans[b.plan as keyof typeof t.admin.plans] ?? b.plan}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[b.status])}>{m.statuses[b.status]}</span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                [m.today, nf(b.today)],
                [m.revenue, money(b.revenue30d)],
                [m.team, nf(b.team)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-muted/50 p-2">
                  <dt className="text-[11px] text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {b.current ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-plum-700">
                <Check className="size-4" aria-hidden /> {m.current}
              </p>
            ) : (
              <button type="button" disabled={switching.pending} onClick={() => void manage(b)} className={cn(SECONDARY_BUTTON, "h-10")}>
                {m.manage}
              </button>
            )}
          </li>
        ))}
      </ul>

      {open ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api("/api/dashboard/branches", { method: "POST", body: { ...form, phone: form.phone || undefined } }), m.created)) {
              setOpen(false);
              setForm({ name: "", city: "", address: "", phone: "" });
            }
          }}
          className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border"
        >
          <h2 className="font-semibold">{m.add}</h2>
          <p className="text-sm text-muted-foreground">{m.addHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={m.name}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} required className={FIELD} />
            </Field>
            <Field label={m.city}>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} maxLength={60} required className={FIELD} />
            </Field>
            <Field label={m.address} className="sm:col-span-2">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={160} required className={FIELD} />
            </Field>
            <Field label={m.phone}>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} inputMode="tel" dir="ltr" className={FIELD} />
            </Field>
          </div>
          <FormError message={error} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pending || form.name.trim().length < 2 || form.city.trim().length < 2 || form.address.trim().length < 5} className={PRIMARY_BUTTON}>
              {m.create}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={SECONDARY_BUTTON}>
              {t.manage.common.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden /> {m.add}
        </button>
      )}
    </div>
  );
}
