"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, Ellipsis, Share, SquarePlus, X } from "lucide-react";
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

/**
 * Navigateur iOS, pour le bon mode d'emploi : Safari 26 et plus (bouton Partager rangé dans le menu « ⋯ »),
 * Safari plus ancien (Partager dans la barre), autre navigateur (Chrome, Firefox… : Partager dans la barre d'adresse)
 */
type IosBrowser = "safariNew" | "safari" | "other";
function iosBrowser(): IosBrowser {
  const ua = navigator.userAgent;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return "other";
  const version = Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0);
  return version >= 26 ? "safariNew" : "safari";
}

/** Message « prêt hors connexion » déjà montré sur cet appareil */
const OFFLINE_READY_KEY = "bh-offline-ready";

/** Pages toujours préchargées pour le hors-ligne, en plus des liens de la page ouverte */
const ALWAYS_OFFLINE = ["/", "/salons", "/offline"];

/**
 * Demande au service worker d'enregistrer la page ouverte, les fichiers qu'elle a déjà chargés (images comprises)
 * et les pages liées (il ne garde que les pages publiques). Économiseur de données : la page ouverte seulement.
 */
function warmOfflinePages() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (process.env.NODE_ENV !== "production" || !navigator.onLine) return;
  const current = window.location.pathname;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='/']"), (a) => new URL(a.href).pathname);
  const paths = connection?.saveData ? [current] : [...new Set([current, ...ALWAYS_OFFLINE, ...links])];
  const files = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => url.startsWith(`${window.location.origin}/`));
  void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: "warm", paths, current, files }));
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
    // Service worker prêt (accueil et page hors ligne enregistrés) : on peut couper le réseau. Annoncé une fois par appareil.
    const onWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "offline-ready") return;
      try {
        if (window.localStorage.getItem(OFFLINE_READY_KEY)) return;
        window.localStorage.setItem(OFFLINE_READY_KEY, "1");
      } catch {
        return;
      }
      toast.success(o.ready, { id: "offline-ready", description: o.readyHint, duration: 5000 });
    };
    if ("serviceWorker" in navigator) {
      // En développement : pas de cache (React n'y démarre pas hors ligne), seulement les notifications push
      const script = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";
      navigator.serviceWorker.register(script, { scope: "/", updateViaCache: "none" }).catch(() => {});
      // Nouveau service worker (première visite, mise à jour) : ce qu'avait reçu l'ancien est effacé avec ses caches
      navigator.serviceWorker.addEventListener("controllerchange", warmOfflinePages);
      navigator.serviceWorker.addEventListener("message", onWorkerMessage);
      navigator.serviceWorker.startMessages();
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
      navigator.serviceWorker?.removeEventListener("controllerchange", warmOfflinePages);
      navigator.serviceWorker?.removeEventListener("message", onWorkerMessage);
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
  const { t } = useI18n();
  const p = t.pwa.install;
  const { available, install } = useInstallPrompt();
  const ios = useSyncExternalStore(noop, isIosBrowser, () => false);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1");
  const [guide, setGuide] = useState(false);
  // Fiche salon et tunnel de réservation : la barre « Réserver » occupe déjà le bas de l'écran
  const busyBottom = /^\/salons\/[^/]+(\/reserver)?$/.test(usePathname());

  if (guide) return <IosInstallGuide onClose={() => setGuide(false)} />;
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
          {available ? p.text : p.iosText}
        </p>
      </div>
      {/* Téléphone : fermer à droite du texte, « Installer » sur toute la largeur en dessous ; écran large : une seule ligne */}
      <button type="button" onClick={close} aria-label={p.later} className="inline-flex size-10 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground hover:bg-muted sm:order-last sm:size-8 sm:self-center">
        <X className="size-4" aria-hidden />
      </button>
      {ios && !available && (
        <button
          type="button"
          onClick={() => setGuide(true)}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-plum-800 sm:h-9 sm:w-auto sm:text-xs"
        >
          <Download className="size-3.5" aria-hidden /> {p.iosCta}
        </button>
      )}
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

/** Mode d'emploi iPhone en 3 étapes : Safari ne propose pas d'installation automatique, il faut passer par son menu */
function IosInstallGuide({ onClose }: { onClose: () => void }) {
  const { t, rich } = useI18n();
  const p = t.pwa.install;
  const steps = p.iosSteps[iosBrowser()];
  const icons = {
    more: <Ellipsis key="m" className="inline size-5 rounded bg-muted p-0.5 align-[-5px]" aria-label="⋯" />,
    share: <Share key="s" className="inline size-5 rounded bg-muted p-0.5 align-[-5px] text-[#007aff]" aria-label={p.iosCta} />,
    add: <SquarePlus key="a" className="inline size-5 rounded bg-muted p-0.5 align-[-5px]" aria-hidden />,
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.iosTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lift sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <p className="flex-1 text-base font-semibold">{p.iosTitle}</p>
          <button type="button" onClick={onClose} aria-label={p.later} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-plum-100 text-xs font-bold text-plum-800">{i + 1}</span>
              <span className="pt-0.5">{rich(step, icons)}</span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="mt-5 h-11 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-plum-800">
          {p.iosDone}
        </button>
      </div>
    </div>
  );
}
