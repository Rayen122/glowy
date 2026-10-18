import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

/** Stat tile : libellé · valeur · variation signée vs période nommée */
export async function StatTile({
  label,
  value,
  delta,
  period,
  upIsGood = true,
  icon,
  children,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  period?: string;
  upIsGood?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const { t, nf } = await getI18n();
  const up = (delta ?? 0) >= 0;
  const good = up === upIsGood;
  return (
    <div className={cn("flex min-w-0 flex-col rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 text-sm text-muted-foreground">{label}</p>
        {icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blush text-plum-700 [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl" data-animate="count">
        {value}
      </p>
      {delta !== undefined && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-success" : "text-destructive")} dir="ltr">
            {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
            {up ? "+" : "−"}
            {nf(Math.abs(delta))} %
          </span>
          <span className="text-muted-foreground">{period ?? t.charts.vsLastMonth}</span>
        </p>
      )}
      {children}
    </div>
  );
}
