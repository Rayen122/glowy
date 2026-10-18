"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Point = { hour: number; value: number };

/**
 * Prévision d'affluence horaire (IA Personne 2) — colonnes, une seule série.
 * Barre de l'heure courante accentuée ; valeur au survol / focus ; table accessible.
 */
export function ForecastBars({
  data,
  currentIndex,
  height = 96,
  className,
}: {
  data: Point[];
  currentIndex?: number;
  height?: number;
  className?: string;
}) {
  const { t, f, hour } = useI18n();
  const c = t.charts;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? currentIndex ?? null;
  const level = (v: number) => (v < 35 ? c.levelCalm : v < 70 ? c.levelModerate : c.levelBusy);

  return (
    <figure className={cn("w-full", className)}>
      <div className="mb-2 min-h-5 text-xs text-muted-foreground" aria-hidden>
        {shown !== null && (
          <>
            <span className="font-semibold text-foreground">{hour(data[shown].hour)}</span> · {level(data[shown].value)} (
            {f(c.occupancy, { n: data[shown].value })})
            {hover === null && currentIndex !== undefined && ` · ${c.now}`}
          </>
        )}
      </div>
      <div className="relative" style={{ height }} dir="ltr">
        {/* ligne de base */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" aria-hidden />
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <button
              key={d.hour}
              type="button"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={f(c.barAria, { hour: hour(d.hour), level: level(d.value), n: d.value })}
              className="group flex h-full flex-1 cursor-default items-end justify-center focus-visible:outline-none"
            >
              <span
                className={cn(
                  "w-full max-w-6 rounded-t-[4px] transition-colors duration-150",
                  i === currentIndex ? "bg-plum-700" : "bg-plum-200",
                  hover === i && i !== currentIndex && "bg-plum-400",
                  "group-focus-visible:ring-2 group-focus-visible:ring-ring"
                )}
                style={{ height: `${Math.max(d.value, 4)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums" aria-hidden dir="ltr">
        <span>{hour(data[0].hour)}</span>
        <span>{hour(data[Math.floor(data.length / 2)].hour)}</span>
        <span>{hour(data[data.length - 1].hour)}</span>
      </div>
      <div className="sr-only">
        <table>
          <caption>{c.forecastCaption}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.hour}>
                <th scope="row">{hour(d.hour)}</th>
                <td>{d.value} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
