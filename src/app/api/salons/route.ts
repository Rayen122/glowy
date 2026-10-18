import { z } from "zod";
import { ok, readQuery, route } from "@/infrastructure/http";
import { searchSalons } from "@/modules/catalog";
import { currentUser } from "@/infrastructure/session";

const query = z.object({
  q: z.string().trim().max(80).optional(),
  ville: z.string().trim().max(60).optional(),
  categorie: z.enum(["coiffure", "barbier", "ongles", "spa", "maquillage", "visage"]).optional(),
  tri: z.enum(["recommande", "note", "prix", "distance"]).optional(),
});

/** GET /api/salons?q=&ville=&categorie=&tri= — recherche (RES-01), salons validés uniquement */
export const GET = route(async (request) => {
  const { q, ville, categorie, tri } = readQuery(request, query);
  const user = await currentUser();
  return ok(await searchSalons({ q, city: ville, category: categorie, sort: tri }, user?.id));
});
