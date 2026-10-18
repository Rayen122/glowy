import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { inbox, markAllRead } from "@/modules/notifications";

/** GET /api/me/notifications — 30 dernières notifications (CLI-07) */
export const GET = route(async () => {
  const user = await requireUser();
  return ok(await inbox(user.id));
});

/** PATCH /api/me/notifications — tout marquer comme lu */
export const PATCH = route(async () => {
  const user = await requireUser();
  return ok({ marked: await markAllRead(user.id, new Date()) });
});
