"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarCheck, Check, LoaderCircle, Play, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";

type Action = "confirm" | "decline" | "start" | "complete" | "noShow";

const ICONS = { confirm: CalendarCheck, decline: X, start: Play, complete: Check, noShow: UserX } as const;

/**
 * Suivi d'un rendez-vous par le salon : confirmer ou refuser une demande, commencer, terminer (crédite les points de la cliente
 * et ouvre le droit à l'avis vérifié) ou marquer absente (pénalité). Les actions possibles à cet instant
 * sont calculées par le serveur (`staffActions`) : rien n'est proposé avant l'heure du rendez-vous.
 */
export function BookingStatusActions({ bookingId, actions }: { bookingId: string; actions: readonly Action[] }) {
  const { t } = useI18n();
  const d = t.dashboard.actions;
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);

  const run = async (action: Action) => {
    setPending(action);
    try {
      // « Refuser » = annulation par le salon : créneau libéré, acompte remboursé, cliente prévenue
      await api(`/api/bookings/${bookingId}`, { method: "PATCH", body: { action: action === "decline" ? "cancel" : action } });
      toast.success(d.done[action]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError && error.code === "TOO_EARLY" ? t.errors.tooEarly : t.errors.generic);
    } finally {
      setPending(null);
    }
  };

  if (!actions.length) return null;

  return (
    <span className="flex shrink-0 gap-1">
      {actions.map((id) => {
        const Icon = ICONS[id];
        const primary = id === "complete" || id === "confirm";
        return (
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
        );
      })}
    </span>
  );
}
