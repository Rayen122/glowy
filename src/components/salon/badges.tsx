"use client";

import { BadgeCheck, Sparkle, Star } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Affluence } from "@/lib/data";
import { cn } from "@/lib/utils";

export function Rating({
  value,
  count,
  className,
  size = "sm",
}: {
  value: number;
  count?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const { t, f, nf } = useI18n();
  const v = nf(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <span
      className={cn("inline-flex items-center gap-1 font-medium text-foreground", size === "md" ? "text-base" : "text-sm", className)}
      aria-label={count !== undefined ? f(t.badges.ratingAriaCount, { value: v, count }) : f(t.badges.ratingAria, { value: v })}
    >
      <Star className={cn("fill-star text-star", size === "md" ? "size-[18px]" : "size-4")} aria-hidden />
      {v}
      {count !== undefined && <span className="font-normal text-muted-foreground">({nf(count)})</span>}
    </span>
  );
}

export function VerifiedBadge({ className, compact }: { className?: string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-medium text-plum-700 ring-1 ring-plum-200",
        className
      )}
      title={t.badges.verifiedTitle}
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">{t.badges.verifiedLong}</span> : t.badges.verified}
    </span>
  );
}

const AFFLUENCE_DOT: Record<Affluence, string> = {
  calme: "bg-success",
  moderee: "bg-warning",
  forte: "bg-destructive",
};

/** Affluence en temps réel (RES-08) — couleur toujours accompagnée d'un libellé */
export function AffluencePill({ level, waitMinutes = 0, className }: { level: Affluence; waitMinutes?: number; className?: string }) {
  const { t, f } = useI18n();
  const dot = AFFLUENCE_DOT[level];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="relative flex size-2 shrink-0">
        {level === "calme" && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-50", dot)} />}
        <span className={cn("relative inline-flex size-2 rounded-full", dot)} />
      </span>
      <span className="font-medium text-foreground">{t.badges.affluence[level]}</span>
      <span>· {waitMinutes ? f(t.badges.waitMin, { m: waitMinutes }) : t.badges.noWait}</span>
    </span>
  );
}

export function PointsBadge({ points, label, className }: { points: number; label?: string; className?: string }) {
  const { t, f } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-xs font-semibold text-gold", className)}>
      <Sparkle className="size-3 shrink-0 fill-current" aria-hidden />
      <span>
        {f(t.common.plusPoints, { n: points })}
        {label ? ` ${label}` : ""}
      </span>
    </span>
  );
}
