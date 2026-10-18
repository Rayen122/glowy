import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { blockSlot, blockSlotInput } from "@/modules/dashboard";

/** POST /api/dashboard/timeoff — { employeeId, date, from, to, label } : bloque un créneau (SAL-04) ; 409 SLOT_TAKEN si déjà occupé */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await blockSlot(actor, await readJson(request, blockSlotInput)), { status: 201 });
});
