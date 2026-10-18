"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Annulation d'un rendez-vous (RES-05) : confirmation en deux temps, pénalité annoncée si tardive */
export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const a = t.account.bookings;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const cancel = async () => {
    setPending(true);
    try {
      const { late } = await api<{ late: boolean }>(`/api/bookings/${bookingId}`, { method: "PATCH", body: { action: "cancel" } });
      toast.success(a.cancelledToast, { description: late ? a.lateCancel : a.cancelledHint });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError && error.code === "NOT_CANCELLABLE" ? a.notCancellable : t.errors.generic);
      setPending(false);
      setConfirming(false);
    }
  };

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-destructive hover:bg-danger-soft">
        {t.account.overview.cancel}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-danger-soft py-1 ps-3 pe-1 text-sm">
      <span className="font-medium text-destructive">{a.confirmCancel}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => void cancel()}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-destructive px-3 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
        {a.yes}
      </button>
      <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold hover:bg-white/70">
        {a.no}
      </button>
    </span>
  );
}

/** Avis vérifié (AVI-01, AVI-02) : note 1–5 et commentaire, possible seulement après un rendez-vous terminé */
export function ReviewDialog({ bookingId, salonName, label }: { bookingId: string; salonName: string; label: string }) {
  const { t, f, locale } = useI18n();
  const r = t.account.reviewForm;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const valid = rating > 0 && text.trim().length >= 10;

  const submit = async () => {
    setPending(true);
    try {
      await api("/api/reviews", { method: "POST", body: { bookingId, rating, text: text.trim(), lang: locale } });
      toast.success(r.thanks, { description: r.thanksHint });
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError && error.code === "ALREADY_REVIEWED" ? t.errors.alreadyReviewed : t.errors.generic);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
        <Star className="size-4" aria-hidden /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{f(r.title, { salon: salonName })}</DialogTitle>
          <DialogDescription>{r.hint}</DialogDescription>
        </DialogHeader>
        <fieldset>
          <legend className="text-sm font-medium">{r.rating}</legend>
          <div className="mt-2 flex gap-1" dir="ltr">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                aria-label={f(t.salon.starsAria, { n })}
                onClick={() => setRating(n)}
                className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-muted"
              >
                <Star className={cn("size-7 transition-colors", n <= rating ? "fill-star text-star" : "text-border")} aria-hidden />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium">
          {r.comment}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            dir="auto"
            placeholder={r.placeholder}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-base font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none md:text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!valid || pending}
          onClick={() => void submit()}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-plum-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {r.submit}
        </button>
      </DialogContent>
    </Dialog>
  );
}
