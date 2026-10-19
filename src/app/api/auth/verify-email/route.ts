import { ok, readJson, route } from "@/infrastructure/http";
import { verifyEmail, verifyEmailInput } from "@/modules/identity";

/** POST /api/auth/verify-email — { token } : confirme l'adresse e-mail (AUTH-06) */
export const POST = route(async (request) => {
  const { token } = await readJson(request, verifyEmailInput);
  return ok(await verifyEmail(token));
});
