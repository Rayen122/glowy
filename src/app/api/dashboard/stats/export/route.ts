import { z } from "zod";
import { csvResponse } from "@/core/domain/csv";
import { route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { requireFeature, salonBookingsCsv, staffSalon } from "@/modules/dashboard";

const query = z.object({ days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)])).default(30) });

/** GET /api/dashboard/stats/export?days=30 — rendez-vous de la période en CSV pour Excel (SAL-11) */
export const GET = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stats");
  const { days } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
  const salon = await staffSalon(actor);
  return csvResponse(await salonBookingsCsv(salon.id, days), `glowy-${salon.slug}-${days}j.csv`);
});
