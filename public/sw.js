/**
 * Service worker Glowy (PWA).
 *
 * Stratégies de cache :
 *  - fichiers statiques versionnés (/_next/static, /icons) : cache d'abord (ils ne changent jamais) ;
 *  - images optimisées (/_next/image) : cache puis mise à jour en arrière-plan ;
 *  - pages publiques (accueil, salons, fiches) : réseau d'abord, copie en cache pour le hors-ligne ;
 *  - pages personnelles (/compte, /dashboard, /admin) et API : réseau uniquement (aucune donnée privée en cache) ;
 *  - sans réseau et sans copie : page /offline.
 * En développement (?dev=1), aucun cache : seules les notifications push sont actives.
 */
const VERSION = "v2";
const STATIC_CACHE = `bh-static-${VERSION}`;
const PAGES_CACHE = `bh-pages-${VERSION}`;
const IMAGES_CACHE = `bh-images-${VERSION}`;
const OFFLINE_URL = "/offline";
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];
const PUBLIC_PAGES = [/^\/$/, /^\/salons(\/[^/]+)?$/, /^\/pro$/, /^\/analyse-beaute$/, /^\/offline$/];
const MAX_IMAGES = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (DEV ? Promise.resolve() : caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bh-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGES_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).then(() => trimCache(IMAGES_CACHE, MAX_IMAGES));
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

async function networkFirstPage(request, cacheable) {
  try {
    const response = await fetch(request);
    if (cacheable && response.ok) (await caches.open(PAGES_CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = cacheable ? await caches.match(request) : undefined;
    return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, PUBLIC_PAGES.some((re) => re.test(url.pathname))));
  }
});

/* ── Notifications push (rappels de rendez-vous, points) ── */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: data.lang,
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url === target);
      return open ? open.focus() : self.clients.openWindow(target);
    })
  );
});
