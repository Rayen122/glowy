"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { api, ConfirmDelete, FIELD, FormError, PRIMARY_BUTTON, useAction } from "./kit";

type Note = { id: string; kind: "allergy" | "preference" | "note"; text: string; createdAt: string; author: string | null };
const KIND_STYLE = { allergy: "bg-danger-soft text-destructive", preference: "bg-blush text-plum-700", note: "bg-muted text-foreground" } as const;

/** SAL-08 : notes du salon sur une cliente */
export function ClientNotes({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const { t, df } = useI18n();
  const m = t.manage.crm;
  const [kind, setKind] = useState<Note["kind"]>("note");
  const [text, setText] = useState("");
  const { run, pending, error } = useAction();
  return (
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api(`/api/dashboard/clients/${clientId}/notes`, { method: "POST", body: { kind, text } }), t.manage.common.created)) setText("");
        }}
        className="space-y-2"
      >
        <div className="flex flex-wrap gap-2">
          {(["allergy", "preference", "note"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("h-9 rounded-full px-3.5 text-sm font-semibold ring-1", kind === k ? "bg-ink text-white ring-ink" : "bg-card ring-border")}>
              {m.kinds[k]}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={m.notePlaceholder} rows={2} maxLength={500} className={cn(FIELD, "h-auto py-2.5")} />
        <FormError message={error} />
        <button type="submit" disabled={pending || text.trim().length < 2} className={cn(PRIMARY_BUTTON, "h-10")}>
          {m.addNote}
        </button>
      </form>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.noNotes}</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", KIND_STYLE[n.kind])}>{m.kinds[n.kind]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm" dir="auto">
                  {n.text}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {df(n.createdAt.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}
                  {n.author && ` · ${n.author}`}
                </p>
              </div>
              <ConfirmDelete compact label={n.text.slice(0, 30)} onConfirm={() => run(() => api(`/api/dashboard/notes/${n.id}`, { method: "DELETE" }), t.manage.common.deleted)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
