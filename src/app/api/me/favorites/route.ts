import { z } from "zod";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { setFavorite, setFavoriteEmployee } from "@/modules/catalog";

/** PUT /api/me/favorites — { salonSlug, employeeKey?, favorite } : ajoute ou retire un salon ou un professionnel favori (CLI-03) */
export const PUT = route(async (request) => {
  const user = await requireUser();
  const { salonSlug, employeeKey, favorite } = await readJson(request, z.object({ salonSlug: z.string().min(1), employeeKey: z.string().min(1).max(40).optional(), favorite: z.boolean() }));
  return ok(employeeKey ? await setFavoriteEmployee(user.id, salonSlug, employeeKey, favorite) : await setFavorite(user.id, salonSlug, favorite));
});
