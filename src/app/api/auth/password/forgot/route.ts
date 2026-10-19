import { ok, readJson, route } from "@/infrastructure/http";
import { forgotPasswordInput, requestPasswordReset } from "@/modules/identity";

/** POST /api/auth/password/forgot — { email } : envoie un lien de réinitialisation (AUTH-05) ; même réponse si le compte n'existe pas */
export const POST = route(async (request) => {
  const { email } = await readJson(request, forgotPasswordInput);
  return ok(await requestPasswordReset(email, new URL(request.url).origin));
});
