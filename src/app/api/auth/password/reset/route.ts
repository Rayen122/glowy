import { ok, readJson, route } from "@/infrastructure/http";
import { resetPassword, resetPasswordInput } from "@/modules/identity";

/** POST /api/auth/password/reset — { token, password } : nouveau mot de passe ; 400 INVALID_TOKEN si le lien est expiré ou déjà utilisé */
export const POST = route(async (request) => {
  const { token, password } = await readJson(request, resetPasswordInput);
  return ok(await resetPassword(token, password));
});
