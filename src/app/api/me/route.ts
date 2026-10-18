import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { getProfile, profileInput, updateProfile } from "@/modules/account";

/** GET /api/me — profil de l'utilisateur connecté */
export const GET = route(async () => {
  const user = await requireUser();
  return ok(await getProfile(user.id));
});

/** PATCH /api/me — modification du profil (CLI-01) */
export const PATCH = route(async (request) => {
  const user = await requireUser();
  return ok(await updateProfile(user.id, await readJson(request, profileInput)));
});
