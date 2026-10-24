"use client";

import { useEffect, useState } from "react";

type SavedPage = { href: string; title: string };

const MAX_LINKS = 12;

/** Titre de la page enregistrée, sans le suffixe « · Glowy » */
async function titleOf(response: Response) {
  const match = (await response.text()).match(/<title>([^<]*)<\/title>/);
  const doc = new DOMParser().parseFromString(match?.[1] ?? "", "text/html");
  return (doc.documentElement.textContent ?? "").replace(/\s*·\s*Glowy$/, "").trim();
}

/** Pages enregistrées par le service worker (public/sw.js), consultables sans connexion */
async function savedPages(): Promise<SavedPage[]> {
  if (!("caches" in window)) return [];
  const names = (await caches.keys()).filter((name) => name.startsWith("bh-pages-") || name.startsWith("bh-private-"));
  const pages = new Map<string, SavedPage>();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      if (url.pathname === "/offline" || pages.has(url.pathname) || pages.size >= MAX_LINKS) continue;
      const response = await cache.match(request);
      const title = response ? await titleOf(response) : "";
      if (title) pages.set(url.pathname, { href: url.pathname, title });
    }
  }
  return [...pages.values()];
}

/** Liste des pages enregistrées sur l'appareil, affichée par la page /offline */
export function OfflinePages({ heading }: { heading: string }) {
  const [pages, setPages] = useState<SavedPage[]>([]);

  useEffect(() => {
    let active = true;
    savedPages()
      .then((list) => active && setPages(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (pages.length === 0) return null;
  return (
    <nav aria-label={heading} className="w-full max-w-sm text-start">
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{heading}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border">
        {pages.map((page) => (
          <li key={page.href}>
            {/* Lien classique (pas <Link>) : la page vient du cache du service worker, sans requête au serveur */}
            <a href={page.href} className="block truncate px-4 py-3 text-sm font-medium hover:bg-muted">
              {page.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
