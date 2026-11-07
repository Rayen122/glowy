import type { MetadataRoute } from "next";

const origin = () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

/** /robots.txt : pages publiques indexables ; espaces personnels, dashboard, admin et API exclus */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/compte", "/dashboard", "/admin", "/offline", "/reinitialiser", "/verifier-email"] }],
    sitemap: `${origin()}/sitemap.xml`,
  };
}
