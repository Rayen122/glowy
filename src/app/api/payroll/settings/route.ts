import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { payrollSettingsInput, updatePayrollRates } from "@/modules/payroll";

/** PUT /api/payroll/settings — { cnssRate, cssRate, irpp } : taux des retenues indicatives du salon */
export const PUT = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await updatePayrollRates(actor, await readJson(request, payrollSettingsInput)));
});
