import type { Metadata } from "next";
import { ForecastBars } from "@/components/charts/forecast-bars";
import { ManageHeader } from "@/components/manage/kit";
import { QueueBoard } from "@/components/manage/queue-board";
import { AffluencePill } from "@/components/salon/badges";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { liveAffluence, salonForecast, salonQueue } from "@/modules/affluence";
import { staffSalon } from "@/modules/dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.queue.title };
}

/** RES-08 : file d'attente virtuelle et affluence du salon, en direct */
export default async function QueuePage() {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const salon = await staffSalon(user);
  const [{ t }, queue, live, forecast] = await Promise.all([getI18n(), salonQueue(salon.id), liveAffluence([salon.id]), salonForecast(salon.id)]);
  const m = t.manage.queue;
  const now = live.get(salon.id)!;
  const currentIndex = forecast.points.findIndex((p) => p.hour === forecast.currentHour);
  return (
    <div className="space-y-5">
      <ManageHeader title={m.title} description={m.description} />
      <div className="grid gap-3 md:grid-cols-[18rem_1fr]">
        <div className="rounded-3xl bg-card p-4 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">{m.affluence}</p>
          <AffluencePill level={now.level} waitMinutes={now.waitMinutes} className="mt-2" />
        </div>
        <div className="rounded-3xl bg-card p-4 ring-1 ring-border">
          <p className="text-xs text-muted-foreground">{m.forecast}</p>
          {forecast.points.length > 0 ? <ForecastBars data={forecast.points} currentIndex={currentIndex >= 0 ? currentIndex : undefined} height={64} className="mt-2" /> : <p className="mt-2 text-sm text-muted-foreground">{t.salon.closedToday}</p>}
        </div>
      </div>
      <QueueBoard queue={queue} />
    </div>
  );
}
