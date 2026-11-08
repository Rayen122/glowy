import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { attendanceInput, correctAttendance } from "@/modules/payroll";

/** PUT /api/payroll/attendance — { employeeId, date, status, segments, note } : correction d'une journée par le gérant */
export const PUT = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await correctAttendance(actor, await readJson(request, attendanceInput)));
});
