import { ok, readJson, route } from "@/infrastructure/http";
import { register, registerInput } from "@/modules/identity";

/** POST /api/auth/register — inscription cliente (AUTH-01) ou salon en attente de validation (AUTH-02) */
export const POST = route(async (request) => {
  const input = await readJson(request, registerInput);
  const { user, salon } = await register(input);
  return ok(
    { userId: user.id, role: user.role, salon: salon ? { id: salon.id, slug: salon.slug, status: salon.status } : null },
    { status: 201 }
  );
});
