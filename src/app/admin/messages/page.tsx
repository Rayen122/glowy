import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import { RunJobsButton } from "@/components/manage/admin-actions";
import { ManageHeader } from "@/components/manage/kit";
import { PaginatedList } from "@/components/ui/paginated-list";
import { utcToTunis } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { latestOutbox } from "@/modules/notifications";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.outboxTitle };
}

/** Boîte d'envoi : e-mails (réels via SMTP ou simulés) et SMS simulés de la démonstration (cahier §1.4) */
export default async function OutboxPage() {
  const [{ t, df }, messages] = await Promise.all([getI18n(), latestOutbox(100)]);
  const m = t.manage.admin;
  return (
    <div className="space-y-5">
      <ManageHeader title={m.outboxTitle} description={m.outboxDescription} action={<RunJobsButton />} />
      <p className="text-sm text-muted-foreground">{m.runJobsHint}</p>
      {messages.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.noOutbox}</p>
      ) : (
        <PaginatedList pageSize={10} className="space-y-3">
          {messages.map((msg) => {
            const at = utcToTunis(msg.createdAt);
            return (
              <li key={msg.id} className="rounded-3xl bg-card p-4 ring-1 ring-border sm:p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                    {msg.channel === "email" ? <Mail className="size-3.5" aria-hidden /> : <MessageSquare className="size-3.5" aria-hidden />}
                    {msg.channel === "email" ? "E-mail" : "SMS"}
                  </span>
                  <span className="font-semibold" dir="ltr">
                    {msg.to}
                  </span>
                  {msg.channel === "email" && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        msg.delivery === "sent" ? "bg-success-soft text-success" : msg.delivery === "failed" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {m.outboxDelivery[msg.delivery]}
                    </span>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">
                    {df(at.date, { day: "numeric", month: "short" })} · <span dir="ltr">{at.time}</span>
                  </span>
                </div>
                {msg.subject && <p className="mt-2 font-medium">{msg.subject}</p>}
                <p className="mt-1 text-sm break-words whitespace-pre-line text-muted-foreground" dir="auto">
                  {msg.text}
                </p>
              </li>
            );
          })}
        </PaginatedList>
      )}
    </div>
  );
}
