import { appOrigin, ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { sendPasswordResetFor } from "@/modules/admin";

/** POST /api/admin/users/:id/reset — le Super Admin envoie un lien de réinitialisation du mot de passe (ADM-04), journalisé */
export const POST = route(async (request, ctx: RouteContext<"/api/admin/users/[id]/reset">) => {
  const { id } = await ctx.params;
  const admin = await requireUser("ADMIN");
  return ok(await sendPasswordResetFor(admin.id, id, appOrigin(request)));
});
