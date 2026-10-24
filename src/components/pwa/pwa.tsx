"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "@/components/brand/logo";
import { useI18n } from "@/i18n/client";

/**
 * PWA côté navigateur : enregistrement du service worker (public/sw.js), préchargement des pages pour le
 * hors-ligne, invitation à installer l'application, alertes de perte / retour de connexion.
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

/** Pages toujours préchargées pour le hors-ligne, en plus des liens de la page ouverte */
const ALWAYS_OFFLINE = ["/", "/salons", "/offline"];

/** Demande au service worker d'enregistrer les pages liées depuis la page ouverte (il ne garde que les pages publiques) */
function warmOfflinePages() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (process.env.NODE_ENV !== "production" || !navigator.onLine || connection?.saveData) return;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/']"), (a) => new URL(a.href).pathname);
  const paths = [...new Set([...ALWAYS_OFFLINE, ...links])];
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: "warm", paths }));
}

/**
 * Sans connexion, un clic sur un lien interne recharge la page entière : elle est alors servie par le cache du
 * service worker (ou /offline). La navigation interne de Next.js, elle, échouerait faute de pouvoir charger
 * les fichiers de la page suivante (« This page couldn't load »).
 */
function fullLoadWhenOffline(event: MouseEvent) {
  if (navigator.onLine || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  // Lien externe, ou ancre dans la même page : comportement normal
  if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
  event.preventDefault();
  window.location.assign(url.href);
}

/** Efface les pages enregistrées sur l'appareil (déconnexion) : elles peuvent contenir des données personnelles */
export function forgetOfflinePages() {
  navigator.serviceWorker?.controller?.postMessage({ type: "forget" });
}

/** À placer une fois dans le layout racine */
export function PwaRegister() {
  const { t } = useI18n();
  const o = t.pwa.offline;
  const pathname = usePathname();

  // Après chaque navigation, une fois la page calme : préchargement des pages liées
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const timer = window.setTimeout(warmOfflinePages, 2500);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // En développement : pas de cache (React n'y démarre pas hors ligne), seulement les notifications push
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
    // Reste affiché tant que la connexion n'est pas revenue (page ouverte depuis le cache comprise)
    const onOffline = () => toast(o.toastOffline, { description: o.toastOfflineHint, id: "network", duration: Infinity });
    const onOnline = () => toast.success(o.toastOnline, { id: "network", description: undefined, duration: 3000 });
    if (!navigator.onLine) onOffline();
    // Phase de capture sur window : passe avant le gestionnaire de <Link> (qui respecte preventDefault)
    window.addEventListener("click", fullLoadWhenOffline, true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("click", fullLoadWhenOffline, true);
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
      className="fixed start-3 end-20 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card p-3 shadow-lift ring-1 ring-border sm:start-6 sm:end-auto sm:bottom-6 sm:w-[420px] sm:flex-nowrap"
    >
      <LogoMark className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{p.title}</p>
        <p className="text-xs text-muted-foreground">
          {available ? p.text : rich(p.iosHint, { share: <Share key="s" className="inline size-3.5 align-[-2px]" aria-label="Partager" /> })}
        </p>
      </div>
      {/* Téléphone : fermer à droite du texte, « Installer » sur toute la largeur en dessous ; écran large : une seule ligne */}
      <button type="button" onClick={close} aria-label={p.later} className="inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted sm:order-last sm:size-8 sm:self-center">
        <X className="size-4" aria-hidden />
      </button>
      {available && (
        <button
          type="button"
          onClick={() => void install().then((accepted) => accepted && close())}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-plum-800 sm:h-9 sm:w-auto sm:text-xs"
        >
          <Download className="size-3.5" aria-hidden /> {p.cta}
        </button>
      )}
    </div>
  );
}
