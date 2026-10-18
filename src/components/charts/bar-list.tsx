import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

/** Classement horizontal (une série) : libellé au début, valeur à l'extrémité. */
export async function BarList({
  items,
  unit = "",
  className,
  color = "bg-plum-600",
}: {
  items: { label: string; value: number }[];
  unit?: string;
  className?: string;
  color?: string;
}) {
  const { nf } = await getI18n();
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {nf(i.value)}
              {unit && <span className="ms-0.5 font-normal text-muted-foreground">{unit}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted" aria-hidden>
            <div data-animate="grow-x" className={cn("h-full rounded-full", color)} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
