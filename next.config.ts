import type { NextConfig } from "next";

/**
 * Politique de contenu minimale, sans casser les scripts de Next.js : pas d'intégration du site dans un autre
 * (clickjacking), pas de <base> ni de plugin, formulaires envoyés seulement au site (et à Google pour sa connexion).
 */
const CSP = ["frame-ancestors 'self'", "base-uri 'self'", "object-src 'none'", "form-action 'self' https://accounts.google.com"].join("; ");

/** Farhty (invitations de mariage, affiché dans /invitations) : la caméra lui est confiée pour scanner les invités */
const FARHTY_ORIGIN = new URL(process.env.FARHTY_URL ?? "https://www.farhty.me").origin;

const nextConfig: NextConfig = {
  // Ne pas annoncer la technologie du serveur (en-tête X-Powered-By)
  poweredByHeader: false,
  /** En-têtes de sécurité (guide PWA Next.js) ; le service worker n'est jamais mis en cache */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: CSP },
          // Ignoré en HTTP (local) ; en HTTPS, le navigateur refuse ensuite toute version non chiffrée du site
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Caméra (analyse beauté, et Farhty pour le scan des invités) et position (salons proches) ; rien d'autre
          { key: "Permissions-Policy", value: `camera=(self "${FARHTY_ORIGIN}"), geolocation=(self), microphone=(), payment=(), usb=()` },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // Le service worker ne contacte que le site, et les tuiles de la carte (gardées pour le hors-ligne)
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; connect-src 'self' https://tile.openstreetmap.org" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    qualities: [60, 75, 90],
  },
};

export default nextConfig;
