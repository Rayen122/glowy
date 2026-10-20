"use client";

import Link from "next/link";
import { useState } from "react";
import { Headset, Plus, Star } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { TicketThread } from "@/modules/support";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON, TEXTAREA, useAction } from "./kit";

type Summary = Omit<TicketThread, "messages"> & { author?: string; role?: string; salon?: string | null };
const STATUS_STYLE = { OPEN: "bg-plum-50 text-plum-800", ANSWERED: "bg-success-soft text-success", CLOSED: "bg-muted text-muted-foreground" } as const;
const CATEGORIES = ["booking", "payment", "account", "review", "other"] as const;

/** AVI-07 : tickets de support (cliente, équipe d'un salon) ou file du Super Admin (`admin`) */
export function SupportCenter({ tickets, thread, admin = false, query = "" }: { tickets: Summary[]; thread: TicketThread | null; admin?: boolean; query?: string }) {
  const { t, f, intl } = useI18n();
  const m = t.manage.support;
  const [creating, setCreating] = useState(!admin && tickets.length === 0);
  const day = (d: Date | string) => new Intl.DateTimeFormat(intl, { timeZone: "Africa/Tunis", day: "numeric", month: "short" }).format(new Date(d));

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-3">
        {!admin && (
          <button type="button" onClick={() => setCreating(true)} className={cn(PRIMARY_BUTTON, "w-full")}>
            <Plus className="size-4" aria-hidden /> {m.newTicket}
          </button>
        )}
        <ul className="divide-y divide-border rounded-3xl bg-card ring-1 ring-border">
          {tickets.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{m.empty}</li>}
          {tickets.map((tk) => (
            <li key={tk.id}>
              <Link
                href={`?${new URLSearchParams({ ...(query ? Object.fromEntries(new URLSearchParams(query)) : {}), ticket: tk.id }).toString()}`}
                aria-current={thread?.id === tk.id ? "true" : undefined}
                onClick={() => setCreating(false)}
                className={cn("block px-4 py-3 hover:bg-muted/50", thread?.id === tk.id && "bg-muted/60")}
              >
                <p className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{tk.subject}</span>
                  {tk.priority && <Star className="size-3.5 shrink-0 fill-gold text-gold" aria-label={m.priority} />}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", STATUS_STYLE[tk.status])}>{m.statuses[tk.status]}</span>
                  {m.categories[tk.category]} · {day(tk.lastMessageAt)} · {f(m.messages, { n: tk.count })}
                </p>
                {admin && tk.author && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {tk.author}
                    {tk.salon ? ` · ${tk.salon}` : ""}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        {creating ? <NewTicket onDone={() => setCreating(false)} /> : thread ? <Thread thread={thread} admin={admin} /> : <p className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{m.choose}</p>}
      </div>
    </div>
  );
}

function NewTicket({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const m = t.manage.support;
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("booking");
  const [text, setText] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api("/api/support", { method: "POST", body: { subject, category, text } }), m.created)) onDone();
      }}
      className="space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border"
    >
      <h2 className="font-semibold">{m.newTicket}</h2>
      <Field label={m.subject}>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required className={FIELD} />
      </Field>
      <Field label={m.category}>
        <select value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])} className={FIELD}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {m.categories[c]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={m.message}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={5} required className={TEXTAREA} />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={pending || subject.trim().length < 5 || text.trim().length < 10} className={PRIMARY_BUTTON}>
        {m.send}
      </button>
    </form>
  );
}

function Thread({ thread, admin }: { thread: TicketThread; admin: boolean }) {
  const { t, intl } = useI18n();
  const m = t.manage.support;
  const [text, setText] = useState("");
  const { run, pending, error } = useAction();
  const closed = thread.status === "CLOSED";
  const when = (d: Date | string) => new Intl.DateTimeFormat(intl, { timeZone: "Africa/Tunis", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(d));

  return (
    <section aria-labelledby="thread-title" className="flex flex-col rounded-3xl bg-card ring-1 ring-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 id="thread-title" className="min-w-0 flex-1 truncate font-semibold">
          {thread.subject}
        </h2>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[thread.status])}>{m.statuses[thread.status]}</span>
        <button type="button" disabled={pending} onClick={() => run(() => api(`/api/support/${thread.id}`, { method: "PATCH", body: { status: closed ? "OPEN" : "CLOSED" } }))} className={cn(SECONDARY_BUTTON, "h-9 px-3.5 text-xs")}>
          {closed ? m.reopen : m.close}
        </button>
      </header>
      <ol className="space-y-3 p-5">
        {thread.messages.map((msg, i) => (
          <li key={i} className={cn("flex", msg.fromSupport === admin ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", msg.fromSupport ? "bg-plum-700 text-white" : "bg-muted")}>
              <p className={cn("mb-1 flex items-center gap-1.5 text-xs", msg.fromSupport ? "text-plum-100" : "text-muted-foreground")}>
                {msg.fromSupport && <Headset className="size-3.5" aria-hidden />}
                {msg.fromSupport ? m.support : msg.author} · {when(msg.at)}
              </p>
              <p className="whitespace-pre-line" dir="auto">
                {msg.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {(!closed || admin) && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api(`/api/support/${thread.id}/messages`, { method: "POST", body: { text } }))) setText("");
          }}
          className="space-y-2 border-t border-border p-4"
        >
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={m.replyPlaceholder} aria-label={m.reply} maxLength={2000} rows={3} className={TEXTAREA} />
          <FormError message={error} />
          <button type="submit" disabled={pending || text.trim().length < 2} className={PRIMARY_BUTTON}>
            {m.reply}
          </button>
        </form>
      )}
    </section>
  );
}
