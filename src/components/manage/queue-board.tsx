"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BellRing, Check, Smartphone, UserX, X } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { SalonQueue } from "@/modules/affluence";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, ICON_BUTTON, PRIMARY_BUTTON, useAction } from "./kit";

const SMALL = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold disabled:opacity-60";
const REFRESH_MS = 15_000;

/** RES-08 : file d'attente du salon, rafraîchie toutes les 15 s */
export function QueueBoard({ queue }: { queue: SalonQueue }) {
  const { t, f } = useI18n();
  const m = t.manage.queue;
  const router = useRouter();
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const { run, pending, error } = useAction();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [router]);

  const act = (id: string, action: "call" | "serve" | "noShow" | "remove") => run(() => api(`/api/dashboard/queue/${id}`, { method: "PATCH", body: { action } }));

  type Row = SalonQueue["waiting"][number] | SalonQueue["called"][number];
  const row = (e: Row) => (
    <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      {"position" in e ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum-50 text-sm font-bold text-plum-800 tabular-nums">{e.position}</span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <BellRing className="size-4" aria-hidden />
        </span>
      )}
      <div className="min-w-40 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {e.name}
          {e.client && (
            <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Smartphone className="size-3" aria-hidden /> {m.app}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {e.service ? `${e.service} · ` : ""}
          {f(m.since, { time: e.since })} · {f(m.waited, { m: e.waitedMinutes })}
          {"waitMinutes" in e && ` · ${f(m.eta, { m: e.waitMinutes })}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {e.status === "WAITING" && (
          <button type="button" disabled={pending} onClick={() => act(e.id, "call")} className={cn(SMALL, "bg-primary text-primary-foreground hover:bg-plum-800")}>
            <BellRing className="size-3.5" aria-hidden /> {m.call}
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => act(e.id, "serve")} className={cn(SMALL, "bg-success-soft text-success hover:opacity-80")}>
          <Check className="size-3.5" aria-hidden /> {m.serve}
        </button>
        {e.status === "CALLED" && (
          <button type="button" disabled={pending} onClick={() => act(e.id, "noShow")} className={cn(SMALL, "border border-border hover:bg-muted")}>
            <UserX className="size-3.5" aria-hidden /> {m.noShow}
          </button>
        )}
        <button type="button" disabled={pending} aria-label={`${m.remove} — ${e.name}`} onClick={() => act(e.id, "remove")} className={ICON_BUTTON}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {queue.called.length > 0 && (
          <section aria-labelledby="queue-called" className="rounded-3xl bg-card ring-1 ring-border">
            <h2 id="queue-called" className="border-b border-border px-5 py-3 font-semibold">
              {m.called} <span className="text-muted-foreground tabular-nums">({queue.called.length})</span>
            </h2>
            <ul className="divide-y divide-border">{queue.called.map(row)}</ul>
          </section>
        )}
        <section aria-labelledby="queue-waiting" className="rounded-3xl bg-card ring-1 ring-border">
          <h2 id="queue-waiting" className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 font-semibold">
            <span>
              {m.waiting} <span className="text-muted-foreground tabular-nums">({queue.waiting.length})</span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">{m.live}</span>
          </h2>
          {queue.waiting.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">{m.empty}</p> : <ul className="divide-y divide-border">{queue.waiting.map(row)}</ul>}
        </section>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/api/dashboard/queue", { method: "POST", body: { name, service: service || undefined } }))) {
            setName("");
            setService("");
          }
        }}
        className="h-fit space-y-3 rounded-3xl bg-card p-5 ring-1 ring-border"
      >
        <h2 className="font-semibold">{m.walkIn}</h2>
        <Field label={m.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className={FIELD} />
        </Field>
        <Field label={m.service}>
          <input value={service} onChange={(e) => setService(e.target.value)} maxLength={80} className={FIELD} />
        </Field>
        <FormError message={error} />
        <button type="submit" disabled={pending || name.trim().length < 2} className={cn(PRIMARY_BUTTON, "w-full")}>
          {m.add}
        </button>
      </form>
    </div>
  );
}
