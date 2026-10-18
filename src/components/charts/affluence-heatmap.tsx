"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import { weekdayIso } from "@/lib/data";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/** Rampe séquentielle prune (une teinte, clair → foncé) */
const RAMP = ["#fbf3f8", "#ebcbe0", "#d9a3c6", "#c077a8", "#8e3b7e", "#521f47"];
const BINS = [20, 40, 60, 80, 90];

const bin = (v: number) => {
  const i = BINS.findIndex((b) => v < b);
  return i === -1 ? RAMP.length - 1 : i;
};

/**
 * Prévision d'affluence (IA Personne 2) : jours × heures, occupation prévue en %.
 * days : jours de la semaine (1 = lundi) · hours : heures pleines. Axe du temps de gauche à droite.
 */
export function AffluenceHeatmap({ days, hours, values }: { days: readonly number[]; hours: readonly number[]; values: number[][] }) {
  const { t, f, df, hour } = useI18n();
  const c = t.charts;
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const cur = hover ? values[hover.d][hover.h] : null;
  const gridRef = useRef<HTMLDivElement>(null);
  const dayShort = (w: number) => df(weekdayIso(w), { weekday: "short" });
  const dayLong = (w: number) => df(weekdayIso(w), { weekday: "long" });

  // Les cases apparaissent en vague diagonale à l'entrée dans l'écran
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.from(grid.querySelectorAll("[data-cell]"), {
          scale: 0.4,
          autoAlpha: 0,
          duration: 0.5,
          ease: "back.out(1.6)",
          stagger: { grid: [days.length, hours.length], from: "start", amount: 0.9 },
          scrollTrigger: { trigger: grid, start: "top 90%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: gridRef }
  );

  return (
    <figure>
      <div className="mb-3 min-h-5 text-sm" aria-hidden>
        {hover && cur !== null ? (
          <span>
            <span className="font-semibold text-foreground" dir="ltr">
              {cur} %
            </span>{" "}
            <span className="text-muted-foreground">
              {f(c.heatDetail, { day: dayLong(days[hover.d]), hour: hour(hours[hover.h]), level: c.levels[bin(cur)] })}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">{c.heatIdle}</span>
        )}
      </div>

      <div className="no-scrollbar -mx-1 overflow-x-auto px-1" dir="ltr">
        <div
          ref={gridRef}
          className="grid min-w-[288px] gap-[2px] sm:min-w-[440px]"
          style={{ gridTemplateColumns: `max-content repeat(${hours.length}, minmax(0, 1fr))` }}
        >
          <span />
          {hours.map((h, hi) => (
            // Téléphone : une heure sur deux, pour que les libellés ne se chevauchent pas
            <span key={h} className={cn("pb-1 text-center text-[11px] text-muted-foreground tabular-nums", hi % 2 === 1 && "max-sm:invisible")}>
              {hour(h)}
            </span>
          ))}
          {days.map((d, di) => (
            <div key={d} className="contents">
              <span className="flex items-center pe-2 text-xs font-medium text-muted-foreground first-letter:uppercase">{dayShort(d)}</span>
              {hours.map((h, hi) => {
                const v = values[di][hi];
                const on = hover?.d === di && hover?.h === hi;
                return (
                  <button
                    key={h}
                    type="button"
                    data-cell
                    onPointerEnter={() => setHover({ d: di, h: hi })}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover({ d: di, h: hi })}
                    onBlur={() => setHover(null)}
                    aria-label={f(c.heatCellAria, { day: dayLong(d), hour: hour(h), n: v })}
                    className={cn(
                      "h-7 cursor-default rounded-[4px] sm:h-8 transition-[outline] focus-visible:outline-none",
                      on && "outline-2 outline-offset-1 outline-ink"
                    )}
                    style={{ backgroundColor: RAMP[bin(v)] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>{c.levels[1]}</span>
          <span className="flex gap-[2px]" aria-hidden dir="ltr">
            {RAMP.map((color) => (
              <span key={color} className="h-3 w-5 rounded-[3px] ring-1 ring-black/5" style={{ backgroundColor: color }} />
            ))}
          </span>
          <span>{c.levels[5]}</span>
        </span>
        <span>{c.heatCaption}</span>
      </figcaption>

      <div className="sr-only">
        <table>
          <caption>{c.heatTableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{c.day}</th>
              {hours.map((h) => (
                <th key={h} scope="col">
                  {hour(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, di) => (
              <tr key={d}>
                <th scope="row">{dayLong(d)}</th>
                {values[di].map((v, hi) => (
                  <td key={hi}>{v} %</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
