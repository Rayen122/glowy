import { ManageHeader } from "@/components/manage/kit";
import { SupportCenter } from "@/components/manage/support-center";
import type { Actor } from "@/core/domain/actor";
import { getI18n } from "@/i18n/server";
import { myTickets, supportQueue, ticketThread } from "@/modules/support";

/** Page support commune (AVI-07) : cliente, équipe d'un salon ou Super Admin */
export async function SupportPage({ actor, ticketId, filter }: { actor: Actor; ticketId?: string; filter?: string }) {
  const admin = actor.role === "ADMIN";
  const [{ t }, tickets, thread] = await Promise.all([
    getI18n(),
    admin ? supportQueue(filter === "all" ? "all" : "open") : myTickets(actor),
    ticketId ? ticketThread(actor, ticketId).catch(() => null) : null,
  ]);
  const m = t.manage.support;
  return (
    <div className="space-y-5">
      <ManageHeader title={admin ? m.adminTitle : m.title} description={admin ? m.adminDescription : m.description} />
      {admin && (
        <nav className="flex gap-2" aria-label={m.adminTitle}>
          {(["open", "all"] as const).map((k) => (
            <a
              key={k}
              href={k === "all" ? "?filtre=all" : "?"}
              aria-current={(filter === "all" ? "all" : "open") === k ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1 ring-border aria-[current=page]:bg-ink aria-[current=page]:text-white aria-[current=page]:ring-ink"
            >
              {m.filters[k]}
            </a>
          ))}
        </nav>
      )}
      <SupportCenter tickets={tickets} thread={thread} admin={admin} query={filter === "all" ? "filtre=all" : ""} />
    </div>
  );
}
