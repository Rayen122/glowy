import { ok, route } from "@/infrastructure/http";
import { currentActor, requireUser } from "@/infrastructure/session";
import { deleteMedia, readMedia } from "@/modules/media";

/** GET /api/media/:id — le fichier lui-même (privé : propriétaire ou Super Admin uniquement) */
export const GET = route(async (_request, ctx: RouteContext<"/api/media/[id]">) => {
  const { id } = await ctx.params;
  const file = await readMedia(await currentActor(), id);
  return new Response(file.body, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.length),
      "content-disposition": `inline; filename="${file.filename}"`,
      "cache-control": file.private ? "private, no-store" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
});

/** DELETE /api/media/:id — suppression par le propriétaire ou le Super Admin */
export const DELETE = route(async (_request, ctx: RouteContext<"/api/media/[id]">) => {
  const { id } = await ctx.params;
  return ok(await deleteMedia(await requireUser(), id));
});
