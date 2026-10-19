import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import { ManageHeader } from "@/components/manage/kit";
import { utcToTunis } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { latestOutbox } from "@/modules/notifications";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.outboxTitle };
}

/** Boîte d'envoi simulée : e-mails et SMS de la démonstration (cahier §1.4 : envoi réel hors périmètre) */
export default async function OutboxPage() {
  const [{ t, df }, messages] = await Promise.all([getI18n(), latestOutbox(100)]);
  const m = t.manage.admin;
  return (
    <div className="space-y-5">
      <ManageHeader title={m.outboxTitle} description={m.outboxDescription} />
      {messages.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.noOutbox}</p>
      ) : (
        <ul className="space-y-3">
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
        </ul>
      )}
    </div>
  );
}
