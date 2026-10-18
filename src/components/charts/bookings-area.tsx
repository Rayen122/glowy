"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useI18n } from "@/i18n/client";

type Datum = { month: string; value: number };

function TooltipCard({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  const { t, f, nf, df } = useI18n();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl bg-card px-3 py-2 shadow-lift ring-1 ring-border" dir="auto">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="h-0.5 w-3 rounded-full bg-series-1" aria-hidden />
        {f(t.charts.bookingsCount, { n: nf(d.value) })}
      </p>
      <p className="text-xs text-muted-foreground">{df(d.month, { month: "long", year: "numeric" })}</p>
    </div>
  );
}

/** Réservations par mois — ligne 2px + aplat 10 %, réticule au survol, valeur finale étiquetée. Axe du temps de gauche à droite. */
export function BookingsArea({ data }: { data: Datum[] }) {
  const { t, nf, df } = useI18n();
  const c = t.charts;
  const config = { value: { label: c.bookings, color: "var(--series-1)" } } satisfies ChartConfig;
  const last = data[data.length - 1];
  return (
    <>
      <div dir="ltr">
        <ChartContainer config={config} className="aspect-auto h-60 w-full sm:h-72">
          <AreaChart data={data} margin={{ top: 24, right: 56, left: -4, bottom: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id="bh-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#efe6e2" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={{ stroke: "#d9ccc6" }}
              tickMargin={8}
              fontSize={11}
              tickFormatter={(iso: string) => df(iso, { month: "short" })}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              fontSize={11}
              ticks={[0, 5000, 10000, 15000]}
              domain={[0, 15000]}
              tickFormatter={(v: number) => nf(v)}
            />
            <Tooltip cursor={{ stroke: "#b9aab4", strokeWidth: 1 }} content={<TooltipCard />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--series-1)"
              strokeWidth={2}
              fill="url(#bh-area)"
              activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: "var(--series-1)" }}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === data.length - 1 ? (
                  <g key="last">
                    <circle cx={props.cx} cy={props.cy} r={5} fill="var(--series-1)" stroke="#ffffff" strokeWidth={2} />
                    <text x={(props.cx ?? 0) + 10} y={(props.cy ?? 0) + 4} fontSize={12} fontWeight={600} fill="#1e1520">
                      {nf(last.value)}
                    </text>
                  </g>
                ) : (
                  <g key={props.index} />
                )
              }
            />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{c.bookingsCaption}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.month}>
                <th scope="row">{df(d.month, { month: "long", year: "numeric" })}</th>
                <td>{nf(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
