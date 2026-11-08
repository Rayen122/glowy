import type { MetadataRoute } from "next";
import { Salon } from "@/infrastructure/db";

const origin = () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");

/** /sitemap.xml : pages publiques et fiches des salons en ligne, lu à la demande (pas de base nécessaire au build) */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin();
  const salons = await Salon.find({ status: "ACTIVE" }, { slug: 1, updatedAt: 1 }).lean();
  const pages = ["", "/salons", "/pro", "/analyse-beaute", "/essai-couleur", "/inscription", "/conditions", "/confidentialite"];
  return [
    ...pages.map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly" as const, priority: path === "" ? 1 : 0.6 })),
    ...salons.map((s) => ({ url: `${base}/salons/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
  ];
}
