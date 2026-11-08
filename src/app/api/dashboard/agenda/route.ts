import { z } from "zod";
import { ownEmployee, staffSalonId } from "@/modules/identity";
import { salonAgenda } from "@/modules/booking";
import { ok, readQuery, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { tunisToday } from "@/core/domain/time";
import { DATE } from "@/core/schemas";

const query = z.object({
  date: DATE.optional(),
  salonId: z.string().optional(),
});

/** GET /api/dashboard/agenda?date= — agenda du jour du salon (SAL-04) ; le gérant ne voit que son salon */
export const GET = route(async (request) => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  const { date, salonId } = readQuery(request, query);
  const agenda = await salonAgenda(await staffSalonId(actor, salonId), date ?? tunisToday());
  if (actor.role !== "EMPLOYEE") return ok(agenda);
  // Employé : seulement sa colonne et ses rendez-vous
  const me = await ownEmployee(actor);
  return ok({ ...agenda, employees: agenda.employees.filter((e) => e.id === me?.id), bookings: agenda.bookings.filter((b) => b.employeeId === me?.id) });
});
