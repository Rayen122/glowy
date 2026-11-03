"use client";

import Image from "next/image";
import { useState } from "react";
import { Flag, MessageSquareText, ShieldAlert, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import type { StaffReviewRow } from "@/modules/reviews";
import { SUSPICION_ALERT } from "@/modules/reviews/domain/analysis";
import { PaginatedList } from "@/components/ui/paginated-list";
import { cn } from "@/lib/utils";
import { api, FIELD, FormError, PRIMARY_BUTTON, useAction } from "./kit";

/** AVI-05 : signalement d'un avis (salon ou utilisateur) */
export function ReportReviewButton({ reviewId, className }: { reviewId: string; className?: string }) {
  const { t } = useI18n();
  const m = t.manage.reviews;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { run, pending, error } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn("inline-flex h-9 items-center gap-1 rounded-full px-2 text-xs hover:bg-muted hover:text-foreground", className)}>
        <Flag className="size-3.5" aria-hidden /> {m.report}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.reportTitle}</DialogTitle>
          <DialogDescription>{m.reportHint}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api(`/api/reviews/${reviewId}`, { method: "PATCH", body: { action: "report", reason } }), m.reported)) {
              setOpen(false);
              setReason("");
            }
          }}
          className="space-y-3"
        >
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={m.reportPlaceholder} rows={3} maxLength={300} className={cn(FIELD, "h-auto py-2.5")} />
          <FormError message={error} />
          <button type="submit" disabled={pending || reason.trim().length < 3} className={cn(PRIMARY_BUTTON, "w-full")}>
            {m.report}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Fiche salon : « Utile » (un vote par personne) et « Signaler » */
export function ReviewFeedback({ reviewId, helpful, loggedIn }: { reviewId: string; helpful: number; loggedIn: boolean }) {
  const { t, f } = useI18n();
  const m = t.manage.reviews;
  const [count, setCount] = useState(helpful);
  const [voted, setVoted] = useState(false);
  if (!loggedIn) {
    return (
      <span className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground" title={m.loginToVote}>
        <ThumbsUp className="size-3.5" aria-hidden /> {f(m.helpful, { n: count })}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <button
        type="button"
        aria-pressed={voted}
        onClick={async () => {
          try {
            const r = await api<{ helpful: number; voted: boolean }>(`/api/reviews/${reviewId}`, { method: "PATCH", body: { action: "helpful" } });
            setCount(r.helpful);
            setVoted(r.voted);
          } catch {
            toast.error(t.errors.generic);
          }
        }}
        className={cn("inline-flex h-9 items-center gap-1 rounded-full px-2 hover:bg-muted hover:text-foreground", voted && "font-semibold text-plum-700")}
      >
        <ThumbsUp className={cn("size-3.5", voted && "fill-current")} aria-hidden /> {f(m.helpful, { n: count })}
      </button>
      <ReportReviewButton reviewId={reviewId} />
    </div>
  );
}

/** AVI-04 : réponse publique du gérant */
function ReplyBox({ review, canReply }: { review: StaffReviewRow; canReply: boolean }) {
  const { t } = useI18n();
  const m = t.manage.reviews;
  const [editing, setEditing] = useState(!review.reply);
  const [text, setText] = useState(review.reply ?? "");
  const { run, pending, error } = useAction();
  if (!canReply) return review.reply ? null : <p className="text-xs text-muted-foreground">{m.managerOnly}</p>;
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center text-sm font-semibold text-plum-700 hover:underline sm:min-h-0">
        {m.editReply}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api(`/api/reviews/${review.id}`, { method: "PATCH", body: { action: "reply", reply: text } }), m.replied)) setEditing(false);
      }}
      className="space-y-2"
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={m.replyPlaceholder} rows={2} maxLength={1000} dir="auto" className={cn(FIELD, "h-auto py-2.5")} />
      <FormError message={error} />
      <button type="submit" disabled={pending || text.trim().length < 2} className={cn(PRIMARY_BUTTON, "h-10")}>
        <MessageSquareText className="size-4" aria-hidden /> {m.reply}
      </button>
    </form>
  );
}

export function ReviewsManager({ reviews, canReply }: { reviews: StaffReviewRow[]; canReply: boolean }) {
  const { t, f, df, tc } = useI18n();
  const m = t.manage.reviews;
  if (!reviews.length) return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.empty}</p>;
  return (
    <PaginatedList pageSize={5} className="space-y-3">
      {reviews.map((r) => (
        <li key={r.id} className={cn("space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border", r.status === "HIDDEN" && "opacity-70")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-semibold">{r.author}</p>
            <span className="inline-flex items-center gap-0.5 text-sm" aria-label={f(t.salon.starsAria, { n: r.rating })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn("size-3.5", n <= r.rating ? "fill-star text-star" : "text-border")} aria-hidden />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">{df(r.date, { day: "numeric", month: "short", year: "numeric" })}</span>
            {r.reported && <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-plum-800">{m.reportedBadge}</span>}
            {r.status === "HIDDEN" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{m.hiddenBadge}</span>}
            {r.suspicion != null && r.suspicion >= SUSPICION_ALERT && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="size-3" aria-hidden /> {f(m.suspicion, { n: r.suspicion })}
              </span>
            )}
            {r.sentiment && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t.dashboard.sentiment[r.sentiment]}</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            {tc(r.service)}
            {r.employee && ` · ${r.employee}`}
          </p>
          <p className="text-sm" lang={r.lang} dir="auto">
            {r.text}
          </p>
          {r.photoUrl && (
            <div className="relative size-28 overflow-hidden rounded-xl bg-muted">
              <Image src={r.photoUrl} alt="" fill sizes="112px" className="object-cover" unoptimized={r.photoUrl.startsWith("/api/media/")} />
            </div>
          )}
          {r.reply && (
            <div className="rounded-xl bg-muted/70 p-3 text-sm">
              <p className="font-semibold">{t.salon.salonReply}</p>
              <p className="mt-1 text-muted-foreground" dir="auto">
                {r.reply}
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ReplyBox review={r} canReply={canReply} />
            </div>
            {!r.reported && r.status === "PUBLISHED" && <ReportReviewButton reviewId={r.id} className="border border-border" />}
          </div>
        </li>
      ))}
    </PaginatedList>
  );
}
