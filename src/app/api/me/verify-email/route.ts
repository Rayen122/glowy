import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { sendEmailVerification } from "@/modules/identity";

/** POST /api/me/verify-email — renvoie le lien de vérification de l'adresse e-mail (AUTH-06) */
export const POST = route(async (request) => {
  const user = await requireUser();
  return ok(await sendEmailVerification(user.id, new URL(request.url).origin));
});
