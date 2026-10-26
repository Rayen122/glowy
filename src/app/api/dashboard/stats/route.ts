import { z } from "zod";
import { ok, readQuery, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { requireFeature, salonStats, staffSalon } from "@/modules/dashboard";

const query = z.object({ days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])).default(30) });

/** GET /api/dashboard/stats?days=7|30|90|365 — statistiques du salon (SAL-06) */
export const GET = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stats");
  const { days } = readQuery(request, query);
  return ok(await salonStats((await staffSalon(actor)).id, days));
});
