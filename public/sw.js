
const VERSION = "v5";
const STATIC_CACHE = `bh-static-${VERSION}`;
const PAGES_CACHE = `bh-pages-${VERSION}`;
const PRIVATE_CACHE = `bh-private-${VERSION}`;
const IMAGES_CACHE = `bh-images-${VERSION}`;
const OFFLINE_URL = "/offline";
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";

const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];
const MANIFEST_URL = "/manifest.webmanifest";
/** Pages enregistrées dès l'installation, avant même d'être consultées */
const WARM_ON_INSTALL = ["/", "/salons"];
const PUBLIC_PAGES = [
  /^\/$/,
  /^\/salons(\/[^/]+)?$/,
  /^\/pro$/,
  /^\/analyse-beaute$/,
  /^\/essai-couleur$/,
  /^\/(conditions|confidentialite)$/,
  /^\/offline$/,
];
const PRIVATE_PAGES = /^\/(compte|dashboard|admin)(\/|$)/;
const LOGIN_PAGES = /^\/(connexion|inscription)$/;
const LIMITS = { [STATIC_CACHE]: 600, [PAGES_CACHE]: 60, [PRIVATE_CACHE]: 40, [IMAGES_CACHE]: 80 };
const NETWORK_TIMEOUT_MS = 4000;
/** Une page publique déjà enregistrée n'est rechargée en arrière-plan qu'au bout de 6 h */
const WARM_MAX_AGE_MS = 6 * 3_600_000;
const MATCH = { ignoreVary: true };

/**
 * Installation : page hors ligne avec ses scripts (sans eux, elle afficherait elle-même « This page couldn't load »),
 * puis accueil et liste des salons. Le service worker ne prend la main qu'une fois la page hors ligne utilisable ;
 * si le réseau coupe pendant l'installation, elle est simplement refaite à la visite suivante.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!DEV) {
        const cache = await caches.open(STATIC_CACHE);
        await Promise.allSettled([...ICONS, MANIFEST_URL].map((url) => cache.add(url)));
        await savePage(STATIC_CACHE, OFFLINE_URL);
        await warm(WARM_ON_INSTALL);
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("bh-") && !k.endsWith(VERSION)).map((k) => caches.delete(k)));
      // Requête réseau lancée pendant le démarrage du service worker : les pages s'ouvrent plus vite
      if (!DEV && self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

const pageCacheFor = (pathname) =>
  PUBLIC_PAGES.some((re) => re.test(pathname)) ? PAGES_CACHE : PRIVATE_PAGES.test(pathname) ? PRIVATE_CACHE : null;

const forgetPages = () => Promise.all([caches.delete(PAGES_CACHE), caches.delete(PRIVATE_CACHE)]);

/** Page hors ligne, ses fichiers et les icônes : jamais effacés pour faire de la place, ils s'affichent quand le reste manque */
async function shellFiles() {
  const copy = await (await caches.open(STATIC_CACHE)).match(OFFLINE_URL, MATCH);
  return new Set([OFFLINE_URL, ...ICONS, ...(copy ? assetUrls(await copy.text()) : [])]);
}

async function trimCache(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const excess = keys.length - LIMITS[name];
  if (excess <= 0) return;
  const keep = name === STATIC_CACHE ? await shellFiles() : new Set();
  const removable = keys.filter((k) => !keep.has(new URL(k.url).pathname));
  await Promise.all(removable.slice(0, excess).map((k) => cache.delete(k)));
}

async function store(name, request, response) {
  await (await caches.open(name)).put(request, response);
  await trimCache(name);
}

/** Copie enregistrée d'une page ; à défaut, la même page sans ses paramètres (/salons?ville=… → /salons) */
async function cachedPage(request, name) {
  if (!name) return undefined;
  const cache = await caches.open(name);
  return (await cache.match(request, MATCH)) ?? (await cache.match(request, { ...MATCH, ignoreSearch: true }));
}

/**
 * Copie utilisable hors connexion : tous ses scripts et styles sont enregistrés. Sinon (fichiers effacés pour faire
 * de la place, préchargement interrompu), Next.js afficherait « This page couldn't load » : mieux vaut la page hors ligne.
 */
async function usable(response) {
  if (!response) return undefined;
  const files = assetUrls(await response.clone().text()).filter((url) => /\.(js|css)$/.test(url));
  const found = await Promise.all(files.map((url) => caches.match(url, MATCH)));
  return found.every(Boolean) ? response : undefined;
}

/**
 * Application ouverte sans connexion (aucune fenêtre du site déjà ouverte) sur une page non enregistrée : sur
 * iPhone, l'application installée peut démarrer sur la page où elle a été ajoutée à l'écran d'accueil ou sur la
 * dernière page vue, et non sur start_url. L'accueil enregistré s'ouvre alors à la place de la page hors ligne ;
 * un lien vers une page non enregistrée, depuis une page ouverte, mène toujours à la page hors ligne.
 */
async function launchPage(pathname) {
  if (pathname === "/" || pathname === OFFLINE_URL || (await self.clients.matchAll({ type: "window" })).length > 0) return undefined;
  const home = await usable(await (await caches.open(PAGES_CACHE)).match("/", MATCH));
  return home && Response.redirect("/", 302);
}

/** Page hors ligne : copie la plus récente, à défaut celle de l'installation */
async function offlinePage() {
  for (const name of [PAGES_CACHE, STATIC_CACHE]) {
    const copy = await usable(await (await caches.open(name)).match(OFFLINE_URL, MATCH));
    if (copy) return copy;
  }
  return caches.match(OFFLINE_URL, MATCH);
}

async function afterNavigation(pathname, name, request, response) {
  // Espace personnel redirigé vers la connexion : la session a expiré, ses pages enregistrées aussi
  if (response.type === "opaqueredirect") return name === PRIVATE_CACHE ? caches.delete(PRIVATE_CACHE) : undefined;
  if (!response.ok) return;
  if (LOGIN_PAGES.test(pathname)) return forgetPages();
  if (!name) return;
  const html = await response.clone().text();
  await store(name, request, response);
  // Scripts chargés avant que le service worker ne contrôle la page, ou plus tard à la demande (carte…)
  await cacheAssetsOf(html).catch(() => {});
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function page(event) {
  const { request } = event;
  const { pathname } = new URL(request.url);
  const name = pageCacheFor(pathname);
  const cached = cachedPage(request, name).then(usable);
  let copy;
  const network = (async () => {
    const response = (await event.preloadResponse) ?? (await fetch(request));
    copy = response.clone();
    return response;
  })();
  // Enregistrement de la copie, même quand la page affichée vient du cache (réseau lent)
  event.waitUntil(network.then(() => afterNavigation(pathname, name, request, copy), () => {}));
  try {
    // Réseau faible : au-delà du délai, la copie enregistrée s'affiche (le réseau la met à jour pour la prochaine fois)
    return await Promise.race([network, delay(NETWORK_TIMEOUT_MS).then(async () => (await cached) ?? network)]);
  } catch {
    return (await cached) ?? (await launchPage(pathname)) ?? (await offlinePage()) ?? Response.error();
  }
}

/**
 * Fichiers du site cités dans une page ou un script (« /_next/static/… » ou « static/chunks/… ») ; en production
 * sur Vercel, Next.js les range sous « static/immutable/chunks/… »
 */
const ASSET_RE = /(?:\/_next\/)?static\/(?:immutable\/)?(?:chunks|media|css)\/[^"'\s\\)]+/g;
const assetUrls = (text) => (text.match(ASSET_RE) ?? []).map((u) => (u.startsWith("/_next/") ? u : `/_next/${u}`));
/** Scripts déjà parcourus depuis le démarrage du service worker */
const scanned = new Set();

/**
 * Scripts et styles d'une page enregistrée en arrière-plan : sans eux elle resterait figée hors connexion
 * (contenu animé masqué tant que le JavaScript n'a pas tourné, aucune interaction). Les scripts chargés à la
 * demande (carte, assistante…) sont cités dans les autres scripts : ils sont suivis et enregistrés aussi.
 */
async function cacheAssetsOf(html) {
  const cache = await caches.open(STATIC_CACHE);
  const queue = [...new Set(assetUrls(html))];
  for (let i = 0; i < queue.length && i < 300; i++) {
    const url = queue[i];
    let response = await cache.match(url, MATCH);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) continue;
      await cache.put(url, response.clone());
    }
    if (!url.includes(".js") || scanned.has(url)) continue;
    scanned.add(url);
    for (const next of assetUrls(await response.text())) if (!queue.includes(next)) queue.push(next);
  }
}

/** Télécharge une page et ses scripts ; échoue si le réseau est coupé */
async function savePage(name, href) {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok || response.redirected) throw new Error(`${href} : ${response.status}`);
  const html = await response.clone().text();
  await (await caches.open(name)).put(href, response);
  await cacheAssetsOf(html);
}

/**
 * Enregistre en arrière-plan les pages publiques liées depuis la page ouverte (hors connexion ensuite), et la page
 * ouverte elle-même, même personnelle : ouverte par un lien (sans rechargement), elle n'est pas passée par le
 * service worker
 */
async function warm(paths, current) {
  for (const path of paths) {
    const url = new URL(path, self.location.origin);
    if (url.origin !== self.location.origin) continue;
    const name = url.pathname === current ? pageCacheFor(url.pathname) : PUBLIC_PAGES.some((re) => re.test(url.pathname)) ? PAGES_CACHE : null;
    if (!name) continue;
    const cached = await (await caches.open(name)).match(url.href, MATCH);
    if (cached && Date.now() - new Date(cached.headers.get("date") ?? 0).getTime() < WARM_MAX_AGE_MS) continue;
    try {
      await savePage(name, url.href);
    } catch (error) {
      if (error instanceof TypeError) return; // hors connexion : inutile d'insister
    }
  }
  await Promise.all([trimCache(PAGES_CACHE), trimCache(PRIVATE_CACHE)]);
}

/** Fichiers gardés pour l'affichage hors connexion : scripts, styles, images, icônes et polices */
const KEPT_FILE = /^\/(_next\/static\/|_next\/image$|icons\/)|\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?)$/;

/**
 * Fichiers déjà affichés par la page (relus dans le cache HTTP du navigateur) : images, et scripts chargés avant
 * que le service worker ne contrôle la page (première visite)
 */
async function keepFiles(hrefs) {
  for (const href of hrefs) {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin || !KEPT_FILE.test(url.pathname) || (await caches.match(url.href, MATCH))) continue;
    try {
      const response = await fetch(url.href);
      if (response.ok) await (await caches.open(url.pathname === "/_next/image" ? IMAGES_CACHE : STATIC_CACHE)).put(url.href, response);
    } catch {
      return;
    }
  }
  await Promise.all([trimCache(IMAGES_CACHE), trimCache(STATIC_CACHE)]);
}

async function cacheFirst(request) {
  const cached = await caches.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) store(STATIC_CACHE, request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) store(STATIC_CACHE, request, response.clone());
    return response;
  } catch {
    return (await caches.match(request, MATCH)) ?? Response.error();
  }
}

/** Hors connexion : la même photo enregistrée à une autre taille (vue en vignette sur une autre page, par exemple) */
async function sameImage(request) {
  const source = new URL(request.url).searchParams.get("url");
  const cache = await caches.open(IMAGES_CACHE);
  const key = (await cache.keys()).find((k) => new URL(k.url).searchParams.get("url") === source);
  return key ? cache.match(key) : undefined;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, MATCH);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) store(IMAGES_CACHE, request, response.clone());
      return response;
    })
    .catch(async () => cached ?? (await sameImage(request)) ?? Response.error());
  return cached ?? network;
}

const ASSETS = new Set(["script", "style", "font", "image", "manifest"]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(page(event));
  } else if (request.headers.get("RSC") === "1") {
    // Clic sur un lien sans connexion : Next.js affiche une erreur si sa requête échoue, mais recharge
    // la page entière si elle reçoit une réponse d'erreur. Ce rechargement est servi par le cache (ci-dessus).
    event.respondWith(fetch(request).catch(() => new Response(null, { status: 503 })));
  } else if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (ASSETS.has(request.destination)) {
    event.respondWith(networkFirst(request));
  }
});

/* Messages des pages : préchargement (« warm ») et oubli des pages enregistrées à la déconnexion (« forget ») */
self.addEventListener("message", (event) => {
  const { type, paths, current, files } = event.data ?? {};
  if (type === "warm" && Array.isArray(paths) && !DEV) {
    event.waitUntil(keepFiles(Array.isArray(files) ? files.slice(0, 150) : []).then(() => warm(paths.slice(0, 40), current)));
  } else if (type === "forget") event.waitUntil(forgetPages());
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
