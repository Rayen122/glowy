"use client";

import { Crown } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { TIERS, tierFor } from "@/lib/data";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<string, string> = {
  bronze: "bg-[#f4e6da] text-bronze",
  argent: "bg-[#eceef2] text-silver",
  or: "bg-gold-soft text-gold",
  platine: "bg-[#e6e9ef] text-platinum",
};

export function TierBadge({ points, className }: { points: number; className?: string }) {
  const { tc } = useI18n();
  const tier = tierFor(points);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", TIER_STYLE[tier.id], className)}>
      <Crown className="size-3.5" aria-hidden /> {tc(tier.label)}
    </span>
  );
}

/** Barre de progression des niveaux (FID-03) : Bronze → Argent → Or → Platine */
export function TierProgress({ lifetime, className, invert }: { lifetime: number; className?: string; invert?: boolean }) {
  const { t, tc, f, nf } = useI18n();
  const current = tierFor(lifetime);
  const idx = TIERS.findIndex((x) => x.id === current.id);
  const next = TIERS[idx + 1];
  const pct = next ? ((lifetime - current.min) / (next.min - current.min)) * 100 : 100;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <span className={invert ? "text-white/80" : "text-muted-foreground"}>
          {next ? (
            <>
              {t.loyalty.stillNeed}{" "}
              <span className={cn("font-semibold", invert ? "text-white" : "text-foreground")}>
                {f(t.common.pointsCount, { n: nf(next.min - lifetime) })}
              </span>{" "}
              {f(t.loyalty.forTier, { tier: tc(next.label) })}
            </>
          ) : (
            t.loyalty.maxTier
          )}
        </span>
        <span className={cn("tabular-nums", invert ? "text-white/80" : "text-muted-foreground")} dir="ltr">
          {nf(lifetime)} / {nf(next?.min ?? lifetime)}
        </span>
      </div>
      <div
        className="mt-3 grid grid-cols-4 gap-1.5"
        role="img"
        aria-label={f(t.loyalty.progressAria, { tier: tc(current.label), pct: Math.round(pct) })}
      >
        {TIERS.map((x, i) => (
          <div key={x.id} className="min-w-0">
            <div className={cn("h-2 overflow-hidden rounded-full", invert ? "bg-white/20" : "bg-muted")}>
              <div
                data-animate="grow-x"
                className={cn("h-full rounded-full", invert ? "bg-[#e9c979]" : "bg-primary")}
                style={{ width: i < idx ? "100%" : i === idx ? `${pct}%` : "0%" }}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 truncate text-xs",
                i === idx ? (invert ? "font-semibold text-white" : "font-semibold text-foreground") : invert ? "text-white/60" : "text-muted-foreground"
              )}
            >
              {tc(x.label)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
