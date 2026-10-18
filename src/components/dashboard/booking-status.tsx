"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, LoaderCircle, Play, UserX } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";

type Action = "start" | "complete" | "noShow";

/**
 * Suivi d'un rendez-vous par le salon : commencer, terminer (crédite les points de la cliente
 * et ouvre le droit à l'avis vérifié) ou marquer absente (pénalité).
 */
export function BookingStatusActions({ bookingId, status }: { bookingId: string; status: string }) {
  const { t } = useI18n();
  const d = t.dashboard.actions;
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);

  const run = async (action: Action) => {
    setPending(action);
    try {
      await api(`/api/bookings/${bookingId}`, { method: "PATCH", body: { action } });
      toast.success(d.done[action]);
      router.refresh();
    } catch {
      toast.error(t.errors.generic);
    } finally {
      setPending(null);
    }
  };

  const actions: { id: Action; icon: typeof Check; primary?: boolean }[] =
    status === "IN_PROGRESS"
      ? [{ id: "complete", icon: Check, primary: true }]
      : status === "CONFIRMED" || status === "PENDING"
        ? [
            { id: "start", icon: Play },
            { id: "complete", icon: Check, primary: true },
            { id: "noShow", icon: UserX },
          ]
        : [];
  if (!actions.length) return null;

  return (
    <span className="flex shrink-0 gap-1">
      {actions.map(({ id, icon: Icon, primary }) => (
        <button
          key={id}
          type="button"
          disabled={pending !== null}
          onClick={() => void run(id)}
          aria-label={d.labels[id]}
          title={d.labels[id]}
          className={
            primary
              ? "inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-plum-800 disabled:opacity-50"
              : "inline-flex size-9 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-50"
          }
        >
          {pending === id ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
        </button>
      ))}
    </span>
  );
}
