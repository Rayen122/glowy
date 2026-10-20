"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BellRing, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import type { Affluence } from "@/lib/data";
import { cn } from "@/lib/utils";
import { AffluencePill } from "./badges";

type Mine = { id: string; status: "WAITING" | "CALLED"; position: number; waitMinutes: number } | null;
export type LiveState = { level: Affluence; waitMinutes: number; waiting: number; open: boolean; mine: Mine };

const REFRESH_MS = 20_000;

/** RES-08 : affluence en direct et file d'attente virtuelle (rafraîchies toutes les 20 s) */
export function LiveQueue({ slug, initial, viewer }: { slug: string; initial: LiveState; viewer: "client" | "staff" | "guest" }) {
  const { t, f } = useI18n();
  const s = t.salon;
  const router = useRouter();
  const pathname = usePathname();
  const [live, setLive] = useState(initial);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLive(await api<LiveState>(`/api/salons/${slug}/live`));
    } catch {
      // hors ligne : on garde la dernière valeur connue
    }
  }, [slug]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function join() {
    if (viewer === "guest") return router.push(`/connexion?callbackUrl=${encodeURIComponent(pathname)}`);
    setPending(true);
    try {
      await api(`/api/salons/${slug}/queue`, { method: "POST", body: {} });
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function leave() {
    setPending(true);
    try {
      await api(`/api/salons/${slug}/queue`, { method: "DELETE" });
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t.errors.generic);
    } finally {
      setPending(false);
    }
  }

  const mine = live.mine;
  return (
    <div className="space-y-3 rounded-2xl bg-muted/70 p-3.5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AffluencePill level={live.level} waitMinutes={live.waitMinutes} />
        {live.waiting > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden /> {f(s.queueWaiting, { n: live.waiting })}
          </span>
        )}
      </div>
      {mine ? (
        <div className={cn("rounded-xl p-3 text-sm", mine.status === "CALLED" ? "bg-success-soft text-success" : "bg-card")}>
          <p className="flex items-center gap-2 font-semibold">
            {mine.status === "CALLED" && <BellRing className="size-4 shrink-0" aria-hidden />}
            {mine.status === "CALLED" ? s.queueCalled : mine.position === 1 && mine.waitMinutes === 0 ? s.queueNext : f(s.queuePosition, { n: mine.position, m: mine.waitMinutes })}
          </p>
          <button type="button" disabled={pending} onClick={() => void leave()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <LogOut className="size-3.5 rtl:rotate-180" aria-hidden /> {s.queueLeave}
          </button>
        </div>
      ) : live.open ? (
        viewer !== "staff" && (
          <div>
            <button type="button" disabled={pending} onClick={() => void join()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-plum-300 bg-card text-sm font-semibold text-plum-800 hover:bg-plum-50 disabled:opacity-60">
              <Users className="size-4" aria-hidden /> {s.queueJoin}
            </button>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">{viewer === "guest" ? s.queueClientOnly : s.queueJoinHint}</p>
          </div>
        )
      ) : (
        <p className="text-xs text-muted-foreground">{s.queueClosed}</p>
      )}
    </div>
  );
}
