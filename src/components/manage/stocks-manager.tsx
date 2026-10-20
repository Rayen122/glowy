"use client";

import { useState } from "react";
import { ArrowDownUp, PackagePlus, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { StockOverview } from "@/modules/dashboard";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, useAction } from "./kit";

type Product = StockOverview["products"][number];
type Reason = "IN" | "OUT" | "SALE" | "ADJUST";

/** SAL-12 : produits, mouvements (toute l'équipe) et fiches produit (gérant) */
export function StocksManager({ data, canEdit }: { data: StockOverview; canEdit: boolean }) {
  const { t, f, nf, money } = useI18n();
  const m = t.manage.stocks;
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [moving, setMoving] = useState<Product | null>(null);
  const { run } = useAction();
  const low = data.products.filter((p) => p.low);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {low.length > 0 ? (
          <p role="status" className="inline-flex items-center gap-2 rounded-full bg-danger-soft px-3.5 py-1.5 text-sm font-semibold text-destructive">
            <TriangleAlert className="size-4" aria-hidden /> {f(m.lowCount, { n: low.length })}
          </p>
        ) : (
          <span />
        )}
        {canEdit && (
          <button type="button" onClick={() => setEditing("new")} className={PRIMARY_BUTTON}>
            <PackagePlus className="size-4" aria-hidden /> {m.add}
          </button>
        )}
      </div>

      <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        {data.products.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">{m.empty}</p>
        ) : (
          <ul className="min-w-[560px] divide-y divide-border">
            {data.products.map((p) => (
              <li key={p.id} className={cn("flex items-center gap-4 px-5 py-3", !p.active && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.usages[p.usage]}
                    {p.price != null && ` · ${money(p.price)}`} · {f(m.minimum, { n: nf(p.threshold) })}
                  </p>
                </div>
                <span className="w-24 text-end font-semibold tabular-nums">{f(m.stock, { n: nf(p.quantity), unit: p.unit })}</span>
                <span className={cn("w-24 rounded-full px-2 py-0.5 text-center text-xs font-semibold", !p.active ? "bg-muted" : p.low ? "bg-danger-soft text-destructive" : "bg-success-soft text-success")}>
                  {!p.active ? m.inactive : p.low ? m.low : m.ok}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {p.active && (
                    <button type="button" onClick={() => setMoving(p)} aria-label={`${m.move} — ${p.name}`} className={ICON_BUTTON}>
                      <ArrowDownUp className="size-4" aria-hidden />
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => setEditing(p)} aria-label={`${t.manage.common.edit} — ${p.name}`} className={ICON_BUTTON}>
                        <Pencil className="size-4" aria-hidden />
                      </button>
                      <ConfirmDelete
                        compact
                        label={p.name}
                        onConfirm={() =>
                          run(async () => {
                            const r = await api<{ deleted: boolean }>(`/api/dashboard/stocks/${p.id}`, { method: "DELETE" });
                            toast.success(r.deleted ? t.manage.common.deleted : m.deactivated);
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section aria-labelledby="stock-history" className="rounded-3xl bg-card p-5 ring-1 ring-border">
        <h2 id="stock-history" className="mb-3 font-semibold">
          {m.history}
        </h2>
        {data.movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.noHistory}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.movements.map((mv) => (
              <li key={mv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums" dir="ltr">
                  {mv.at.date} {mv.at.time}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {mv.product} · {m.reasons[mv.reason]}
                  {mv.note && <span className="text-muted-foreground"> — {mv.note}</span>}
                  {mv.by && <span className="text-xs text-muted-foreground"> · {f(m.by, { name: mv.by })}</span>}
                </span>
                <span className={cn("font-semibold tabular-nums", mv.delta > 0 ? "text-success" : "text-destructive")} dir="ltr">
                  {mv.delta > 0 ? "+" : ""}
                  {nf(mv.delta)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <ProductDialog key={editing === "new" ? "new" : editing.id} product={editing} onClose={() => setEditing(null)} />}
      {moving && <MoveDialog key={moving.id} product={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}

function ProductDialog({ product, onClose }: { product: Product | "new"; onClose: () => void }) {
  const { t } = useI18n();
  const m = t.manage.stocks;
  const isNew = product === "new";
  const [draft, setDraft] = useState({
    name: isNew ? "" : product.name,
    usage: isNew ? ("salon" as const) : product.usage,
    unit: isNew ? "pcs" : product.unit,
    threshold: isNew ? "2" : String(product.threshold),
    price: isNew || product.price == null ? "" : String(product.price),
    quantity: "0",
    active: isNew ? true : product.active,
  });
  const { run, pending, error } = useAction();
  const body = { name: draft.name, usage: draft.usage, unit: draft.unit, threshold: draft.threshold, price: draft.price === "" ? null : draft.price, active: draft.active };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? m.addTitle : m.editTitle}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const call = () => (isNew ? api("/api/dashboard/stocks", { method: "POST", body: { ...body, quantity: draft.quantity } }) : api(`/api/dashboard/stocks/${product.id}`, { method: "PATCH", body }));
            if (await run(call, isNew ? t.manage.common.created : t.manage.common.saved)) onClose();
          }}
          className="space-y-3"
          noValidate
        >
          <Field label={m.name}>
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={m.namePlaceholder} maxLength={80} required className={FIELD} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={m.usage}>
              <select value={draft.usage} onChange={(e) => setDraft({ ...draft, usage: e.target.value as "salon" | "vente" })} className={FIELD}>
                <option value="salon">{m.usages.salon}</option>
                <option value="vente">{m.usages.vente}</option>
              </select>
            </Field>
            <Field label={m.unit}>
              <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} maxLength={10} className={FIELD} />
            </Field>
            {isNew && (
              <Field label={m.quantity}>
                <input type="number" inputMode="numeric" min={0} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className={FIELD} />
              </Field>
            )}
            <Field label={m.threshold}>
              <input type="number" inputMode="numeric" min={0} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: e.target.value })} className={FIELD} />
            </Field>
            <Field label={m.price}>
              <input type="number" inputMode="decimal" min={0} step="0.5" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={FIELD} />
            </Field>
          </div>
          {!isNew && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5 text-sm font-medium">
              {t.manage.common.active}
              <Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} />
            </label>
          )}
          <FormError message={error} />
          <button type="submit" disabled={pending || draft.name.trim().length < 2} className={cn(PRIMARY_BUTTON, "w-full")}>
            {pending ? t.manage.common.saving : t.manage.common.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t, f } = useI18n();
  const m = t.manage.stocks;
  const [reason, setReason] = useState<Reason>("IN");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const { run, pending, error } = useAction();
  const sign = reason === "IN" ? 1 : reason === "ADJUST" ? 1 : -1;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{f(m.moveTitle, { name: product.name })}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const delta = sign * Number(amount);
            if (await run(() => api(`/api/dashboard/stocks/${product.id}/moves`, { method: "POST", body: { delta, reason, note: note || undefined } }), t.manage.common.saved)) onClose();
          }}
          className="space-y-3"
        >
          <div role="radiogroup" aria-label={m.move} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["IN", "OUT", "SALE", "ADJUST"] as const).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={cn("h-10 rounded-xl text-sm font-semibold ring-1", reason === r ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}>
                {m.reasons[r]}
              </button>
            ))}
          </div>
          <Field label={reason === "ADJUST" ? `${m.amount} (±)` : m.amount}>
            <input type="number" inputMode="numeric" min={reason === "ADJUST" ? undefined : 1} value={amount} onChange={(e) => setAmount(e.target.value)} required className={FIELD} />
          </Field>
          <Field label={m.note}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className={FIELD} />
          </Field>
          <FormError message={error} />
          <button type="submit" disabled={pending || !Number(amount)} className={cn(PRIMARY_BUTTON, "w-full")}>
            {m.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
