"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { useI18n } from "@/i18n/client";

type Datum = { date: string; revenue: number };

function TooltipCard({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
  const { t, money, df } = useI18n();
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl bg-card px-3 py-2 shadow-lift ring-1 ring-border" dir="auto">
      <p className="text-sm font-semibold text-foreground">{d.revenue ? money(d.revenue) : t.charts.closed}</p>
      <p className="text-xs text-muted-foreground">{df(d.date, { weekday: "short", day: "numeric", month: "short" })}</p>
    </div>
  );
}

/** CA journalier — colonnes, une série (pas de légende : le titre la nomme). Axe du temps de gauche à droite. */
export function RevenueBars({ data }: { data: Datum[] }) {
  const { t, nf, money, df } = useI18n();
  const c = t.charts;
  const config = { revenue: { label: c.revenue, color: "var(--series-1)" } } satisfies ChartConfig;
  const max = Math.max(...data.map((d) => d.revenue));
  const label = (iso: string) => df(iso, { day: "numeric", month: "short" });
  return (
    <>
      <div dir="ltr">
        <ChartContainer config={config} className="aspect-auto h-56 w-full sm:h-64">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="#efe6e2" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: "#d9ccc6" }}
              interval={6}
              tickMargin={8}
              fontSize={11}
              tickFormatter={label}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              fontSize={11}
              tickFormatter={(v: number) => nf(v)}
              ticks={[0, 500, 1000, 1500, 2000]}
              domain={[0, 2000]}
            />
            <Tooltip cursor={{ fill: "rgb(107 42 92 / 0.06)" }} content={<TooltipCard />} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={18}>
              {data.map((d) => (
                <Cell key={d.date} fill={d.revenue === max ? "var(--series-1)" : "#d9a3c6"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{c.revenueCaption}</caption>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{label(d.date)}</th>
                <td>{d.revenue ? money(d.revenue) : c.closed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
