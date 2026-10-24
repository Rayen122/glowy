"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CheckCircle2, Clock, KeyRound, LayoutDashboard, PauseCircle, PlayCircle, Unlock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { api, FIELD, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

const SMALL = "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-muted disabled:opacity-60";

type SalonAction = "approve" | "reject" | "suspend" | "reactivate";

/** ADM-02 / ADM-03 : actions sur un salon selon son statut ; refus et suspension demandent un motif */
export function SalonActions({ id, name, status }: { id: string; name: string; status: string }) {
  const { t } = useI18n();
  const m = t.manage.admin;
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [asking, setAsking] = useState<SalonAction | null>(null);
  const [reason, setReason] = useState("");

  const act = (action: SalonAction, motive?: string) => run(() => api(`/api/admin/salons/${id}`, { method: "PATCH", body: { action, reason: motive || undefined } }), m.done);

  async function openDashboard() {
    try {
      await api("/api/admin/view-salon", { method: "POST", body: { salonId: id } });
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "PENDING" && (
        <>
          <button type="button" disabled={pending} onClick={() => act("approve")} className={cn(SMALL, "border-success/40 text-success")}>
            <CheckCircle2 className="size-3.5" aria-hidden /> {m.approve}
          </button>
          <button type="button" disabled={pending} onClick={() => setAsking("reject")} className={cn(SMALL, "text-destructive")}>
            <XCircle className="size-3.5" aria-hidden /> {m.reject}
          </button>
        </>
      )}
      {status === "ACTIVE" && (
        <button type="button" disabled={pending} onClick={() => setAsking("suspend")} className={cn(SMALL, "text-destructive")}>
          <PauseCircle className="size-3.5" aria-hidden /> {m.suspend}
        </button>
      )}
      {status === "SUSPENDED" && (
        <button type="button" disabled={pending} onClick={() => act("reactivate")} className={cn(SMALL, "text-success")}>
          <PlayCircle className="size-3.5" aria-hidden /> {m.reactivate}
        </button>
      )}
      <button type="button" onClick={openDashboard} className={SMALL}>
        <LayoutDashboard className="size-3.5" aria-hidden /> {m.viewDashboard}
      </button>

      <Dialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {asking === "reject" ? m.reject : m.suspend} — {name}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (asking && (await act(asking, reason))) {
                setAsking(null);
                setReason("");
              }
            }}
            className="space-y-3"
          >
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.reasonPlaceholder} maxLength={300} rows={3} className={cn(FIELD, "h-auto py-2.5")} />
            <FormError message={error} />
            <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON, "w-full bg-destructive hover:bg-destructive/90")}>
              {asking === "reject" ? m.reject : m.suspend}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** ADM-04 : bloquer, débloquer, envoyer un lien de réinitialisation */
export function UserActions({ id, status, isSelf }: { id: string; status: string; isSelf: boolean }) {
  const { t } = useI18n();
  const m = t.manage.admin;
  const { run, pending } = useAction();
  if (isSelf) return <span className="text-xs text-muted-foreground">{m.self}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "ACTIVE" ? (
        <button type="button" disabled={pending} onClick={() => run(() => api(`/api/admin/users/${id}`, { method: "PATCH", body: { action: "block" } }), m.done)} className={cn(SMALL, "text-destructive")}>
          <Ban className="size-3.5" aria-hidden /> {m.block}
        </button>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => api(`/api/admin/users/${id}`, { method: "PATCH", body: { action: "unblock" } }), m.done)} className={cn(SMALL, "text-success")}>
          <Unlock className="size-3.5" aria-hidden /> {m.unblock}
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => run(() => api(`/api/admin/users/${id}/reset`, { method: "POST" }), m.resetSent)} className={SMALL}>
        <KeyRound className="size-3.5" aria-hidden /> {m.resetPassword}
      </button>
    </div>
  );
}

/** Pagination par liens (garde les filtres de l'adresse) */
export function Pager({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  const href = (p: number) => `?${new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter((e): e is [string, string] => Boolean(e[1]))).toString()}`;
  return <Pagination page={page} pages={pages} href={href} />;
}

/** RES-07 / FID-07 : lancement manuel des tâches planifiées (démonstration) */
export function RunJobsButton() {
  const { t, f } = useI18n();
  const m = t.manage.admin;
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        const done = await run(() => api<{ reminders: number; warned: number; expired: number }>("/api/cron", { method: "POST" }));
        if (done) toast.success(f(m.jobsDone, done));
      }}
      className={SECONDARY_BUTTON}
    >
      <Clock className="size-4" aria-hidden /> {m.runJobs}
    </button>
  );
}
