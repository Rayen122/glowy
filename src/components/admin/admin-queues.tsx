"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, EyeOff, FileText, ShieldAlert, ShieldCheck, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FlaggedReviewRow as Flagged, PendingSalonRow as Pending } from "@/modules/admin";

/** Validation des nouveaux salons (ADM-02) — cartes sur mobile, tableau à partir de md */
export function PendingSalons({ initial }: { initial: readonly Pending[] }) {
  const { t, tc, f, ago } = useI18n();
  const q = t.admin.queues;
  const router = useRouter();
  const [rows, setRows] = useState([...initial]);
  const [pending, setPending] = useState<string | null>(null);

  /** ADM-02 : décision enregistrée et journalisée côté serveur (PATCH /api/admin/salons/:id) */
  const decide = async (row: Pending, ok: boolean) => {
    setPending(row.id);
    try {
      await api(`/api/admin/salons/${row.id}`, { method: "PATCH", body: { action: ok ? "approve" : "reject" } });
      setRows((r) => r.filter((x) => x.id !== row.id));
      if (ok) toast.success(f(q.approved, { name: row.name }), { description: q.approvedDesc });
      else toast(f(q.rejected, { name: row.name }), { description: q.rejectedDesc });
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setPending(null);
    }
  };

  if (!rows.length) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-2xl bg-success-soft p-6 text-sm font-medium text-success">
        <ShieldCheck className="size-4" aria-hidden /> {q.noPending}
      </p>
    );
  }

  const meta = (r: Pending) => `${r.owner} · ${tc(r.category)} · ${ago(r.hoursAgo * 60)}`;

  const actions = (r: Pending) => (
    <div className="flex justify-end gap-1.5">
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void decide(r, false)}
        className="inline-flex h-10 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:bg-danger-soft hover:text-destructive"
      >
        <X className="size-3.5" aria-hidden /> {q.reject}
      </button>
      <button
        type="button"
        disabled={pending !== null}
        onClick={() => void decide(r, true)}
        className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-plum-800"
      >
        <Check className="size-3.5" aria-hidden /> {q.approve}
      </button>
    </div>
  );

  const docLink = (r: Pending) => (
    <button type="button" className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-plum-700 hover:underline">
      <FileText className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{r.document}</span>
    </button>
  );

  return (
    <>
      {/* Même tableau sur tous les écrans ; défilement horizontal sur téléphone */}
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2.5 pe-3 text-start font-medium">
              {q.colSalon}
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-medium">
              {q.colCity}
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-medium">
              {q.colPlan}
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-medium">
              {q.colDocument}
            </th>
            <th scope="col" className="py-2.5 ps-3 text-end font-medium">
              {q.colDecision}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-3 pe-3">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-muted-foreground">{meta(r)}</p>
              </td>
              <td className="px-3 py-3">{tc(r.city)}</td>
              <td className="px-3 py-3">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold whitespace-nowrap">{t.admin.plans[r.plan]}</span>
              </td>
              <td className="max-w-44 px-3 py-3">{docLink(r)}</td>
              <td className="py-3 ps-3">{actions(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

/** File de modération (AVI-06) — score IA, décision humaine */
export function ModerationQueue({ initial }: { initial: readonly Flagged[] }) {
  const { t, tc, f } = useI18n();
  const q = t.admin.queues;
  const router = useRouter();
  const [rows, setRows] = useState([...initial]);
  const [pending, setPending] = useState<string | null>(null);

  /** AVI-06 : décision humaine finale (PATCH /api/reviews/:id), signalements clos et journalisés */
  const act = async (row: Flagged, action: "keep" | "hide") => {
    setPending(row.id);
    try {
      await api(`/api/reviews/${row.id}`, { method: "PATCH", body: { action } });
      setRows((r) => r.filter((x) => x.id !== row.id));
      toast.success(action === "keep" ? q.kept : q.hidden, { description: f(q.decisionLogged, { salon: row.salon }) });
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setPending(null);
    }
  };

  if (!rows.length) {
    return <p className="rounded-2xl bg-success-soft p-6 text-center text-sm font-medium text-success">{q.emptyModeration}</p>;
  }

  return (
    <ul className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-1">
      {rows.map((r) => {
        const high = r.score >= 60;
        return (
          <li key={r.id} className="rounded-2xl p-4 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{r.author}</span> <span className="text-muted-foreground">{f(q.on, { salon: r.salon })}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3.5 fill-star text-star" aria-hidden /> <span dir="ltr">{r.rating}/5</span> ·{" "}
                  {f(q.reportedBy, { who: q.reporters[r.reportedBy] })}
                </p>
              </div>
              <div className="w-full sm:w-40 sm:shrink-0">
                <p className={cn("flex items-center gap-1 text-xs font-semibold sm:justify-end", high ? "text-destructive" : "text-muted-foreground")}>
                  {high && <ShieldAlert className="size-3.5" aria-hidden />}
                  {f(q.suspicion, { n: r.score })}
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted" role="img" aria-label={f(q.suspicionAria, { n: r.score })}>
                  <div className={cn("h-full rounded-full", high ? "bg-destructive" : "bg-[#b9aab4]")} style={{ width: `${r.score}%` }} />
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm" lang={r.lang} dir="auto">
              « {r.text} »
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {r.reasons.map((reason) => (
                <li key={reason} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                  {tc(reason)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap justify-end gap-1.5">
              <button type="button" disabled={pending !== null} onClick={() => void act(r, "keep")} className="inline-flex h-10 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:bg-muted">
                <Check className="size-3.5" aria-hidden /> {q.keep}
              </button>
              <button type="button" disabled={pending !== null} onClick={() => void act(r, "hide")} className="inline-flex h-10 items-center gap-1 rounded-full bg-ink px-3 text-xs font-semibold text-white hover:bg-plum-800">
                <EyeOff className="size-3.5" aria-hidden /> {q.hide}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
