
const VERSION = "v5";
const STATIC_CACHE = `bh-static-${VERSION}`;
const PAGES_CACHE = `bh-pages-${VERSION}`;
const PRIVATE_CACHE = `bh-private-${VERSION}`;
const IMAGES_CACHE = `bh-images-${VERSION}`;
/** Tuiles de la carte (OpenStreetMap) déjà affichées */
const TILES_CACHE = `bh-tiles-${VERSION}`;
const TILE_HOST = "tile.openstreetmap.org";
const OFFLINE_URL = "/offline";
const DEV = new URL(self.location.href).searchParams.get("dev") === "1";

const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];
const MANIFEST_URL = "/manifest.webmanifest";
/** Pages enregistrées dès l'installation, avant même d'être consultées */
const WARM_ON_INSTALL = ["/"];
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
const LIMITS = { [STATIC_CACHE]: 600, [PAGES_CACHE]: 60, [PRIVATE_CACHE]: 40, [IMAGES_CACHE]: 160, [TILES_CACHE]: 300 };
const NETWORK_TIMEOUT_MS = 4000;
/** Une page publique déjà enregistrée n'est rechargée en arrière-plan qu'au bout de 6 h */
const WARM_MAX_AGE_MS = 6 * 3_600_000;
const MATCH = { ignoreVary: true };

/**
 * Installation : page hors ligne avec ses scripts (sans eux, elle afficherait elle-même « This page couldn't load »),
 * puis l'accueil. Le service worker ne prend la main qu'une fois la page hors ligne utilisable ; si le réseau coupe
 * pendant l'installation, elle est simplement refaite à la visite suivante. Le reste (salons, pages liées) est
 * préchargé ensuite, à la demande de la page.
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
      // L'application s'ouvre désormais sans connexion : la page l'annonce (une fois par appareil)
      if (!DEV) for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "offline-ready" });
    })()
  );
});

const pageCacheFor = (pathname) =>
  PUBLIC_PAGES.some((re) => re.test(pathname)) ? PAGES_CACHE : PRIVATE_PAGES.test(pathname) ? PRIVATE_CACHE : null;

/**
 * Session des pages enregistrées : augmente à chaque oubli (connexion, déconnexion). Un enregistrement commencé avant
 * s'arrête au lieu de remettre une page de l'ancienne session (« Se connecter », ou l'espace personnel après déconnexion).
 */
let generation = 0;

/**
 * Vide un cache sans le supprimer : un cache supprimé pendant qu'un préchargement le tient ouvert recevrait encore
 * ses pages, mais hors de la liste des caches (perdues)
 */
async function clearCache(name) {
  const cache = await caches.open(name);
  await Promise.all((await cache.keys()).map((key) => cache.delete(key)));
}

const forgetPages = () => {
  generation++;
  return Promise.all([clearCache(PAGES_CACHE), clearCache(PRIVATE_CACHE)]);
};

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
 * Scripts et styles dont la page a besoin, tous enregistrés ? Les scripts `nomodule` (anciens navigateurs) ne
 * comptent pas : les téléphones actuels ne les chargent jamais, ils ne passent donc pas par le service worker.
 */
async function complete(html) {
  const legacy = new Set(
    [...html.matchAll(/<script\b[^>]*\bnomodule\b[^>]*>/gi)].flatMap((m) => assetUrls(m[0]))
  );
  const files = assetUrls(html).filter((url) => /\.(js|css)$/.test(url) && !legacy.has(url));
  const found = await Promise.all(files.map((url) => caches.match(url, MATCH)));
  return found.every(Boolean);
}

/**
 * Copie utilisable hors connexion : tous ses scripts et styles sont enregistrés. Sinon (fichiers effacés pour faire
 * de la place, préchargement interrompu), Next.js afficherait « This page couldn't load » : mieux vaut la page hors ligne.
 */
async function usable(response) {
  if (!response) return undefined;
  return (await complete(await response.clone().text())) ? response : undefined;
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

async function afterNavigation(pathname, name, request, response, gen) {
  // Espace personnel redirigé vers la connexion : la session a expiré, ses pages enregistrées aussi
  if (response.type === "opaqueredirect") {
    if (name !== PRIVATE_CACHE) return;
    generation++;
    return clearCache(PRIVATE_CACHE);
  }
  if (!response.ok) return;
  if (LOGIN_PAGES.test(pathname)) return forgetPages();
  if (!name) return;
  // Scripts chargés avant que le service worker ne contrôle la page, ou plus tard à la demande (carte…)
  await keepPage(name, request, response, gen, true).catch(() => {});
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function page(event) {
  const { request } = event;
  const { pathname } = new URL(request.url);
  const name = pageCacheFor(pathname);
  const gen = generation;
  const cached = cachedPage(request, name).then(usable);
  let copy;
  const network = (async () => {
    const response = (await event.preloadResponse) ?? (await fetch(request));
    copy = response.clone();
    return response;
  })();
  // Enregistrement de la copie, même quand la page affichée vient du cache (réseau lent)
  event.waitUntil(network.then(() => afterNavigation(pathname, name, request, copy, gen), () => {}));
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

/** Fichiers absents du cache, téléchargés 6 à la fois (un par un, l'installation prenait 10 s sur un réseau mobile) */
async function cacheFiles(urls) {
  const cache = await caches.open(STATIC_CACHE);
  const queue = [...new Set(urls)];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      if (await cache.match(url, MATCH)) continue;
      const response = await fetch(url); // réseau coupé : TypeError, l'enregistrement s'arrête
      if (response.ok) await cache.put(url, response);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

/** Scripts chargés à la demande (carte, assistante…) : cités dans les scripts de la page, suivis et enregistrés */
async function followScripts(urls) {
  const queue = [...new Set(urls)].filter((url) => url.includes(".js"));
  for (let i = 0; i < queue.length && scanned.size < 300; i++) {
    const url = queue[i];
    if (scanned.has(url)) continue;
    const response = await caches.match(url, MATCH);
    if (!response) continue;
    const found = assetUrls(await response.text());
    await cacheFiles(found);
    scanned.add(url);
    for (const next of found) if (next.includes(".js") && !queue.includes(next)) queue.push(next);
  }
}

/**
 * Enregistre une page une fois ses scripts et styles enregistrés : sans eux elle resterait figée hors connexion
 * (contenu animé masqué tant que le JavaScript n'a pas tourné, aucune interaction). Interrompu (application
 * fermée, réseau coupé), l'ancienne copie reste : elle n'est jamais remplacée par une copie incomplète.
 */
async function keepPage(name, key, response, gen = generation, withImages = false) {
  const html = await response.clone().text();
  const files = assetUrls(html);
  await cacheFiles(files);
  // Pas complète, ou session changée entre-temps (connexion, déconnexion) : rien n'est remplacé
  if (!(await complete(html)) || gen !== generation) return false;
  await store(name, key, response);
  await followScripts(files).catch(() => {}); // la page est déjà utilisable sans eux
  if (withImages) await cacheImages(imageUrls(html)).catch(() => {});
  return true;
}

/** Télécharge une page et ses scripts ; échoue si le réseau est coupé ou si la page reste incomplète */
async function savePage(name, href, gen = generation) {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok || response.redirected) throw new Error(`${href} : ${response.status}`);
  if (!(await keepPage(name, href, response, gen))) throw new Error(`${href} : fichiers manquants`);
}

/**
 * Enregistre en arrière-plan les pages publiques liées depuis la page ouverte (hors connexion ensuite), et la page
 * ouverte elle-même, même personnelle : ouverte par un lien (sans rechargement), elle n'est pas passée par le
 * service worker
 */
async function warm(paths, current) {
  const gen = generation;
  for (const path of paths) {
    if (gen !== generation) return; // session changée : un autre préchargement suit
    const url = new URL(path, self.location.origin);
    if (url.origin !== self.location.origin) continue;
    const name = url.pathname === current ? pageCacheFor(url.pathname) : PUBLIC_PAGES.some((re) => re.test(url.pathname)) ? PAGES_CACHE : null;
    if (!name) continue;
    // Copie récente et complète : rien à refaire (une copie incomplète, laissée par une ancienne version, est refaite)
    const cached = await (await caches.open(name)).match(url.href, MATCH);
    if (cached && Date.now() - new Date(cached.headers.get("date") ?? 0).getTime() < WARM_MAX_AGE_MS && (await usable(cached))) continue;
    try {
      await savePage(name, url.href, gen);
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
    const isTile = url.hostname === TILE_HOST;
    if ((url.origin !== self.location.origin && !isTile) || !KEPT_FILE.test(url.pathname) || (await caches.match(url.href, MATCH))) continue;
    try {
      const response = await (isTile ? fetchTile(url.href) : fetch(url.href));
      if (response.ok) await (await caches.open(isTile ? TILES_CACHE : url.pathname === "/_next/image" ? IMAGES_CACHE : STATIC_CACHE)).put(url.href, response);
    } catch {
      return;
    }
  }
  await Promise.all([trimCache(IMAGES_CACHE), trimCache(STATIC_CACHE), trimCache(TILES_CACHE)]);
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

/**
 * Photos d'une page, une taille par photo (la plus proche de 640 px) : sans elles, les photos jamais affichées en
 * ligne (bas de page) apparaissent cassées hors connexion. Toute autre taille demandée est servie par sameImage.
 */
function imageUrls(html) {
  const urls = [];
  for (const [, set] of html.matchAll(/\b(?:image)?srcset="([^"]+)"/gi)) {
    const sizes = set
      .replace(/&amp;/g, "&")
      .split(",")
      .map((candidate) => candidate.trim().split(/\s+/)[0])
      .filter((url) => url.startsWith("/_next/image?"))
      .map((url) => [url, Number(new URL(url, self.location.origin).searchParams.get("w"))]);
    sizes.sort((a, b) => Math.abs(a[1] - 640) - Math.abs(b[1] - 640));
    if (sizes.length) urls.push(sizes[0][0]);
  }
  return [...new Set(urls)].slice(0, 24);
}

/** Photos de la page ouverte, une fois ses pages liées préchargées (les pages liées restent légères) */
async function currentImages(current) {
  const name = typeof current === "string" ? pageCacheFor(current) : null;
  if (!name) return;
  const copy = await (await caches.open(name)).match(new URL(current, self.location.origin).href, { ...MATCH, ignoreSearch: true });
  if (copy) await cacheImages(imageUrls(await copy.text()));
}

/** Photos absentes (aucune taille de la même photo enregistrée), téléchargées 4 à la fois */
async function cacheImages(urls) {
  const cache = await caches.open(IMAGES_CACHE);
  const queue = [...urls];
  const worker = async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      if (await sameImage(new Request(new URL(url, self.location.origin)))) continue;
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  await trimCache(IMAGES_CACHE);
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

/** Tuile demandée en CORS (OpenStreetMap l'autorise) : une réponse opaque compterait des Mo dans le quota */
const fetchTile = (href) => fetch(href, { mode: "cors", credentials: "omit" });
/** Tuile transparente : hors ligne, une zone jamais vue de la carte reste vide au lieu d'images cassées */
const BLANK_TILE = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));

async function tile(request) {
  const cached = await caches.match(request.url, MATCH);
  if (cached) return cached;
  try {
    const response = await fetchTile(request.url);
    if (response.ok) store(TILES_CACHE, request.url, response.clone());
    return response;
  } catch {
    return new Response(BLANK_TILE, { headers: { "Content-Type": "image/png" } });
  }
}

const ASSETS = new Set(["script", "style", "font", "image", "manifest"]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (DEV || request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.hostname === TILE_HOST) return event.respondWith(tile(request));
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
  const { type, paths, current, files, forget } = event.data ?? {};
  if (type === "warm" && Array.isArray(paths) && !DEV) {
    // Session changée (connexion, déconnexion) : les pages enregistrées avec l'ancienne sont refaites
    event.waitUntil(
      (forget ? forgetPages() : Promise.resolve())
        .then(() => keepFiles(Array.isArray(files) ? files.slice(0, 150) : []))
        .then(() => warm(paths.slice(0, 40), current))
        .then(() => currentImages(current))
    );
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
