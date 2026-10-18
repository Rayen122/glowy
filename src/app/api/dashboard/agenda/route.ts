import { z } from "zod";
import { staffSalonId } from "@/modules/identity";
import { salonAgenda } from "@/modules/booking";
import { ok, readQuery, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { tunisToday } from "@/core/domain/time";

const query = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  salonId: z.string().optional(),
});

/** GET /api/dashboard/agenda?date= — agenda du jour du salon (SAL-04) ; le gérant ne voit que son salon */
export const GET = route(async (request) => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { date, salonId } = readQuery(request, query);
  return ok(await salonAgenda(await staffSalonId(actor, salonId), date ?? tunisToday()));
});
