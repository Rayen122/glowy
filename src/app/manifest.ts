import type { MetadataRoute } from "next";
import { LOCALE_META } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

/** Manifeste de la PWA (installation sur l'écran d'accueil), dans la langue de l'utilisatrice */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { t, locale } = await getI18n();
  return {
    id: "/",
    name: t.pwa.name,
    short_name: "Glowy",
    description: t.meta.description,
    lang: LOCALE_META[locale].intl,
    dir: LOCALE_META[locale].dir,
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7f4",
    theme_color: "#fbf7f4",
    categories: ["lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: t.pwa.shortcuts.book, url: "/salons?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.pwa.shortcuts.bookings, url: "/compte/rendez-vous?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: t.pwa.shortcuts.dashboard, url: "/dashboard?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
