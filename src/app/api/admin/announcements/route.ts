import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { announcementInput, listAnnouncements, sendAnnouncement } from "@/modules/platform";

/** GET /api/admin/announcements — annonces envoyées (ADM-10) */
export const GET = route(async () => {
  await requireUser("ADMIN");
  return ok(await listAnnouncements());
});

/** POST /api/admin/announcements — { title, body, audience: ALL|CLIENTS|SALONS, link } : notification à chaque destinataire */
export const POST = route(async (request) => {
  const actor = await requireUser("ADMIN");
  return ok(await sendAnnouncement(actor.id, await readJson(request, announcementInput)), { status: 201 });
});
