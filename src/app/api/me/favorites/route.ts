import { z } from "zod";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { setFavorite } from "@/modules/catalog";

/** PUT /api/me/favorites — { salonSlug, favorite } : ajoute ou retire un favori (CLI-03) */
export const PUT = route(async (request) => {
  const user = await requireUser();
  const { salonSlug, favorite } = await readJson(request, z.object({ salonSlug: z.string().min(1), favorite: z.boolean() }));
  return ok(await setFavorite(user.id, salonSlug, favorite));
});
