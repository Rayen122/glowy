"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { useI18n } from "@/i18n/client";

/**
 * PWA côté navigateur : enregistrement du service worker, invitation à installer l'application,
 * alertes de perte / retour de connexion.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/* Invitation d'installation (Chrome, Edge, Android) partagée entre la bannière et le menu */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useInstallPrompt() {
  const available = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return outcome === "accepted";
  };
  return { available, install };
}

/** iPhone / iPad dans Safari, application pas encore installée (pas d'invitation automatique sur iOS) */
const isIosBrowser = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator as Navigator & { standalone?: boolean }).standalone;
const noop = () => () => {};

/** À placer une fois dans le layout racine */
export function PwaRegister() {
  const { t } = useI18n();
  const o = t.pwa.offline;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // En développement : pas de cache (évite les fichiers périmés), seulement les notifications push
      const script = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
      navigator.serviceWorker.register(script, { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      deferredPrompt = null;
      notify();
    };
    const onOffline = () => toast(o.toastOffline, { description: o.toastOfflineHint, id: "network" });
    const onOnline = () => toast.success(o.toastOnline, { id: "network" });
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [o]);

  return null;
}

const DISMISS_KEY = "bh-install-dismissed";

/** Bannière discrète « Installer Glowy » (Android / desktop) ou mode d'emploi iOS */
export function InstallBanner() {
  const { t, rich } = useI18n();
  const p = t.pwa.install;
  const { available, install } = useInstallPrompt();
  const ios = useSyncExternalStore(noop, isIosBrowser, () => false);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1");
  // Fiche salon et tunnel de réservation : la barre « Réserver » occupe déjà le bas de l'écran
  const busyBottom = /^\/salons\/[^/]+(\/reserver)?$/.test(usePathname());

  if (dismissed || busyBottom || !(available || ios)) return null;

  const close = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="dialog"
      aria-label={p.title}
      className="fixed start-3 end-20 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl bg-card p-3 shadow-lift ring-1 ring-border sm:start-6 sm:end-auto sm:bottom-6 sm:w-[360px]"
    >
      <LogoMark className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{p.title}</p>
        <p className="text-xs text-muted-foreground">
          {available ? p.text : rich(p.iosHint, { share: <Share key="s" className="inline size-3.5 align-[-2px]" aria-label="Partager" /> })}
        </p>
      </div>
      {available && (
        <button
          type="button"
          onClick={() => void install().then((accepted) => accepted && close())}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-plum-800"
        >
          <Download className="size-3.5" aria-hidden /> {p.cta}
        </button>
      )}
      <button type="button" onClick={close} aria-label={p.later} className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
