import { isIsoDate, tunisToday } from "@/core/domain/time";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { cashierDay, checkout, checkoutInput, currentSalonId } from "@/modules/dashboard";

/** GET /api/dashboard/cashier?date=AAAA-MM-JJ — journée de caisse (SAL-09) */
export const GET = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  const date = new URL(request.url).searchParams.get("date");
  return ok(await cashierDay(await currentSalonId(actor), date && isIsoDate(date) ? date : tunisToday()));
});

/** POST /api/dashboard/cashier — { bookingId | clientName, lines, discount, method } : encaissement, crée la facture */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await checkout(actor, await readJson(request, checkoutInput)), { status: 201 });
});
