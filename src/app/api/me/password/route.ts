import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { changePassword, changePasswordInput } from "@/modules/identity";

/** PATCH /api/me/password — { current, next } : changer son mot de passe ; 401 si l'actuel est faux */
export const PATCH = route(async (request) => {
  const user = await requireUser();
  const { current, next } = await readJson(request, changePasswordInput);
  return ok(await changePassword(user.id, current, next));
});
