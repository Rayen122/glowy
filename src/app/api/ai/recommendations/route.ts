import { z } from "zod";
import { ok, readQuery, route } from "@/infrastructure/http";
import { currentActor } from "@/infrastructure/session";
import { recommendedSalons } from "@/modules/catalog";

const query = z.object({ limit: z.coerce.number().int().min(1).max(20).default(6), discover: z.enum(["0", "1"]).default("0") });

/**
 * GET /api/ai/recommendations?limit=6&discover=1 — salons recommandés (IA P1) avec score et raison.
 * Cliente connectée : profil (catégories, prestations, ville, budget) ; visiteur : repli « popularité ».
 */
export const GET = route(async (request) => {
  const { limit, discover } = readQuery(request, query);
  const actor = await currentActor();
  const salons = await recommendedSalons(limit, actor?.id, { excludeVisited: discover === "1" });
  return ok(salons.map((s) => ({ slug: s.slug, name: s.name, city: s.city, category: s.category, score: s.matchScore, reason: s.reason ?? null })));
});
