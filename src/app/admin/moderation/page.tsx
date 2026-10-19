import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ModerationQueue } from "@/components/admin/admin-queues";
import { ManageHeader } from "@/components/manage/kit";
import { utcToTunis } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { adminQueues, moderationHistory } from "@/modules/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.moderationTitle };
}

/** AVI-06 : file des avis signalés (décision humaine) et décisions récentes */
export default async function ModerationPage() {
  const [{ t, df }, queues, history] = await Promise.all([getI18n(), adminQueues(), moderationHistory()]);
  const m = t.manage.admin;
  return (
    <div className="space-y-6">
      <ManageHeader title={m.moderationTitle} description={m.moderationDescription} />
      <section className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6">
        <ModerationQueue initial={queues.flagged} />
      </section>
      <section aria-labelledby="history-title" className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-6">
        <h2 id="history-title" className="mb-3 font-semibold">
          {m.history}
        </h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{m.noHistory}</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className={cn("w-24 shrink-0 self-start rounded-full px-2.5 py-1 text-center text-xs font-semibold", h.decision === "HIDDEN" ? "bg-danger-soft text-destructive" : "bg-success-soft text-success")}>
                  {m.decisions[h.decision]}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {h.salon} ·{" "}
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="size-3.5 fill-star text-star" aria-hidden /> {h.rating}/5
                    </span>
                  </p>
                  <p className="line-clamp-2 text-muted-foreground" dir="auto">
                    « {h.text} »
                  </p>
                  <p className="text-xs text-muted-foreground">{h.reason}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {df(utcToTunis(h.resolvedAt).date, { day: "numeric", month: "short" })}
                  {h.by && ` · ${h.by}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
