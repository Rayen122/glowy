"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX2, Check, LoaderCircle, Play, UserX } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BookingAction = "confirm" | "decline" | "cancel" | "start" | "complete" | "noShow";

// Refuser / annuler : agenda barré, jamais la croix ✕ qui ferme les fenêtres
const ICONS = { confirm: CalendarCheck, decline: CalendarX2, cancel: CalendarX2, start: Play, complete: Check, noShow: UserX } as const;
/** Actions irréversibles qui préviennent la cliente : un second clic confirme */
const SENSITIVE: readonly BookingAction[] = ["decline", "cancel", "noShow"];

/**
 * Suivi d'un rendez-vous par le salon : confirmer ou refuser une demande, annuler un rendez-vous à venir, commencer,
 * terminer (crédite les points de la cliente et ouvre le droit à l'avis vérifié) ou marquer absente (pénalité).
 * Les actions possibles à cet instant sont calculées par le serveur (`staffActions`) : rien n'est proposé avant
 * l'heure du rendez-vous. `labelled` : boutons avec leur texte (fiche du rendez-vous) ; sinon icônes (listes).
 */
export function BookingStatusActions({ bookingId, actions, labelled = false }: { bookingId: string; actions: readonly BookingAction[]; labelled?: boolean }) {
  const { t } = useI18n();
  const d = t.dashboard.actions;
  const router = useRouter();
  const [pending, setPending] = useState<BookingAction | null>(null);
  const [armed, setArmed] = useState<BookingAction | null>(null);

  // Un bouton armé se désarme seul au bout de 4 s
  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(null), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  const run = async (action: BookingAction) => {
    if (SENSITIVE.includes(action) && armed !== action) return setArmed(action);
    setArmed(null);
    setPending(action);
    try {
      // « Refuser » / « Annuler » = annulation par le salon : créneau libéré, acompte remboursé, cliente prévenue
      await api(`/api/bookings/${bookingId}`, { method: "PATCH", body: { action: action === "decline" ? "cancel" : action } });
      toast.success(d.done[action]);
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      toast.error(code === "TOO_EARLY" ? t.errors.tooEarly : error instanceof ApiError && error.status < 500 ? error.message : t.errors.generic);
    } finally {
      setPending(null);
    }
  };

  if (!actions.length) return null;

  return (
    <span className={cn("flex shrink-0 gap-1", labelled && "flex-wrap justify-end gap-2")}>
      {actions.map((id) => {
        const Icon = ICONS[id];
        const primary = id === "complete" || id === "confirm";
        const isArmed = armed === id;
        const label = isArmed ? d.confirmAgain[id as keyof typeof d.confirmAgain] : d.labels[id];
        return (
          <button
            key={id}
            type="button"
            disabled={pending !== null}
            onClick={() => void run(id)}
            aria-label={labelled ? undefined : label}
            title={label}
            className={cn(
              "inline-flex items-center justify-center rounded-full disabled:opacity-50",
              labelled ? "h-10 gap-1.5 px-4 text-sm font-semibold" : "size-9",
              isArmed
                ? "bg-destructive text-white hover:bg-destructive/90"
                : primary
                  ? "bg-primary text-primary-foreground hover:bg-plum-800"
                  : "border border-border hover:bg-muted"
            )}
          >
            {pending === id ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            {labelled && <span>{label}</span>}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {armed ? d.confirmAgain[armed as keyof typeof d.confirmAgain] : ""}
      </span>
    </span>
  );
}
