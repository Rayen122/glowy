import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { supportQueue } from "@/modules/support";

/** GET /api/admin/support?filtre=all — file des tickets (prioritaires et plus anciens d'abord) */
export const GET = route(async (request) => {
  await requireUser("ADMIN");
  return ok(await supportQueue(new URL(request.url).searchParams.get("filtre") === "all" ? "all" : "open"));
});
