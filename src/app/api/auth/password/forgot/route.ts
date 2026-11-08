import { appOrigin, ok, readJson, route } from "@/infrastructure/http";
import { clientIp, rateLimit } from "@/infrastructure/rate-limit";
import { forgotPasswordInput, requestPasswordReset } from "@/modules/identity";
import { emailIsSimulated } from "@/modules/notifications";

/**
 * POST /api/auth/password/forgot — { email } : envoie un lien de réinitialisation (AUTH-05) ; même réponse si le compte n'existe pas.
 * simulated : true quand aucun serveur SMTP n'est configuré (e-mail visible seulement dans la boîte d'envoi du Super Admin).
 */
export const POST = route(async (request) => {
  rateLimit("passwordForgot", clientIp(request));
  const { email } = await readJson(request, forgotPasswordInput);
  return ok({ ...(await requestPasswordReset(email, appOrigin(request))), simulated: emailIsSimulated() });
});
