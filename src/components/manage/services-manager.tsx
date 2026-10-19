"use client";

import { useState } from "react";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { ManagedService } from "@/modules/dashboard";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, TEXTAREA, useAction } from "./kit";

type Draft = { name: string; group: string; description: string; durationMin: string; price: string; oldPrice: string; popular: boolean; active: boolean };

const EMPTY: Draft = { name: "", group: "", description: "", durationMin: "30", price: "", oldPrice: "", popular: false, active: true };

const toDraft = (s: ManagedService): Draft => ({
  name: s.name,
  group: s.group,
  description: s.description ?? "",
  durationMin: String(s.durationMin),
  price: String(s.price),
  oldPrice: s.oldPrice != null ? String(s.oldPrice) : "",
  popular: s.popular,
  active: s.active,
});

/** SAL-03 : catalogue des prestations du salon */
export function ServicesManager({ services }: { services: ManagedService[] }) {
  const { t, f, tc, money, dur } = useI18n();
  const m = t.manage;
  const [editing, setEditing] = useState<ManagedService | "new" | null>(null);
  const { run } = useAction();
  const groups = [...new Set(services.map((s) => s.group))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{f(services.length > 1 ? m.services.countOther : m.services.countOne, { n: services.length })}</p>
        <button type="button" onClick={() => setEditing("new")} className={PRIMARY_BUTTON}>
          <Plus className="size-4" aria-hidden /> {m.services.add}
        </button>
      </div>

      {services.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.services.empty}</p>
      ) : (
        groups.map((group) => (
          <section key={group} aria-label={group} className="rounded-3xl bg-card ring-1 ring-border">
            <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-muted-foreground">{tc(group)}</h2>
            <ul className="divide-y divide-border">
              {services
                .filter((s) => s.group === group)
                .map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <div className="min-w-40 flex-1">
                      <p className={cn("flex flex-wrap items-center gap-2 font-medium", !s.active && "text-muted-foreground")}>
                        {tc(s.name)}
                        {s.popular && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blush px-2 py-0.5 text-xs font-semibold text-plum-700">
                            <Sparkles className="size-3" aria-hidden /> {m.services.popularBadge}
                          </span>
                        )}
                        {!s.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{m.services.hidden}</span>}
                      </p>
                      {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{tc(s.description)}</p>}
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">{dur(s.durationMin)}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {s.oldPrice != null && <s className="me-1.5 font-normal text-muted-foreground">{money(s.oldPrice)}</s>}
                      {money(s.price)}
                    </span>
                    <span className="ms-auto flex items-center gap-1">
                      <button type="button" onClick={() => setEditing(s)} aria-label={`${m.common.edit} — ${s.name}`} className={ICON_BUTTON}>
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <ConfirmDelete compact label={s.name} onConfirm={() => run(() => api(`/api/dashboard/services/${s.id}`, { method: "DELETE" }), m.common.deleted)} />
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}

      <ServiceDialog key={editing === "new" ? "new" : (editing?.id ?? "closed")} service={editing} groups={groups} onClose={() => setEditing(null)} />
    </div>
  );
}

function ServiceDialog({ service, groups, onClose }: { service: ManagedService | "new" | null; groups: string[]; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.manage;
  const isNew = service === "new";
  const [draft, setDraft] = useState<Draft>(service && service !== "new" ? toDraft(service) : EMPTY);
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = {
      name: draft.name,
      group: draft.group,
      description: draft.description || null,
      durationMin: Number(draft.durationMin),
      price: Number(draft.price),
      oldPrice: draft.oldPrice ? Number(draft.oldPrice) : null,
      popular: draft.popular,
      active: draft.active,
    };
    const done = await run(
      () => (isNew ? api("/api/dashboard/services", { method: "POST", body }) : api(`/api/dashboard/services/${(service as ManagedService).id}`, { method: "PATCH", body })),
      isNew ? m.common.created : m.common.saved
    );
    if (done) onClose();
  }

  return (
    <Dialog open={service !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? m.services.addTitle : m.services.editTitle}</DialogTitle>
          <DialogDescription>{m.services.deleteHint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label={m.services.name}>
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} required maxLength={80} className={FIELD} />
          </Field>
          <Field label={m.services.group} hint={m.services.groupHint}>
            <input value={draft.group} onChange={(e) => set("group", e.target.value)} list="service-groups" required maxLength={40} className={FIELD} />
            <datalist id="service-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <Field label={`${m.services.descriptionField} (${m.common.optional})`}>
            <textarea value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={300} rows={2} className={TEXTAREA} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={m.services.duration}>
              <input type="number" inputMode="numeric" min={5} max={600} step={5} value={draft.durationMin} onChange={(e) => set("durationMin", e.target.value)} required className={FIELD} />
            </Field>
            <Field label={m.services.price}>
              <input type="number" inputMode="numeric" min={0} value={draft.price} onChange={(e) => set("price", e.target.value)} required className={FIELD} />
            </Field>
            <Field label={m.services.oldPrice} hint={m.services.oldPriceHint} className="col-span-2 sm:col-span-1">
              <input type="number" inputMode="numeric" min={0} value={draft.oldPrice} onChange={(e) => set("oldPrice", e.target.value)} className={FIELD} />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
            {m.services.popular}
            <Switch checked={draft.popular} onCheckedChange={(v) => set("popular", v)} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
            {m.services.activeField}
            <Switch checked={draft.active} onCheckedChange={(v) => set("active", v)} />
          </label>
          <FormError message={error} />
          <button type="submit" disabled={pending || !draft.name.trim() || !draft.group.trim() || draft.price === ""} className={cn(PRIMARY_BUTTON, "w-full")}>
            {pending ? m.common.saving : m.common.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
