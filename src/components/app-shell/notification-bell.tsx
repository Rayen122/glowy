"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; body: string; link?: string; readAt: string | null; createdAt: string };
type Inbox = { unread: number; notifications: Item[]; loadedAt: number };

const POLL_MS = 30_000;

/** Cloche de notifications (CLI-07) : lit /api/me/notifications, compteur réel, liste et « tout marquer comme lu » */
export function NotificationBell({ className }: { className?: string }) {
  const { t, f, ago } = useI18n();
  const s = t.shell;
  const [inbox, setInbox] = useState<Inbox>({ unread: 0, notifications: [], loadedAt: 0 });
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/me/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const { data } = (await response.json()) as { data: Omit<Inbox, "loadedAt"> };
      setInbox({ ...data, loadedAt: Date.now() });
    } catch {
      /* hors ligne : on garde l'état précédent */
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [load]);

  async function markAllRead() {
    await fetch("/api/me/notifications", { method: "PATCH" });
    await load();
  }

  const label = inbox.unread ? f(s.notificationsUnread, { n: inbox.unread }) : s.notifications;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger
        aria-label={label}
        className={cn("relative inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)}
      >
        <Bell className="size-5" aria-hidden />
        {inbox.unread > 0 && (
          <span className="absolute end-1 top-1 flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4.5 font-bold text-white ring-2 ring-background">
            {inbox.unread > 9 ? "9+" : inbox.unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
          <p className="font-semibold">{s.notifications}</p>
          {inbox.unread > 0 && (
            <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs font-medium text-plum-700 hover:underline">
              <CheckCheck className="size-3.5" aria-hidden />
              {s.markAllRead}
            </button>
          )}
        </div>
        {inbox.notifications.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-sm text-muted-foreground">{s.notificationsEmpty}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {inbox.notifications.map((n) => {
              const minutes = Math.max(0, Math.round((inbox.loadedAt - new Date(n.createdAt).getTime()) / 60_000));
              const content = (
                <>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-destructive")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{ago(minutes)}</span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} onClick={() => setOpen(false)} className="flex gap-2.5 px-3.5 py-3 hover:bg-muted">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex gap-2.5 px-3.5 py-3">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
