import { createBooking, createBookingInput, listClientBookings } from "@/modules/booking";
import { ok, readJson, route } from "@/infrastructure/http";
import { rateLimit } from "@/infrastructure/rate-limit";
import { requireUser } from "@/infrastructure/session";

/** GET /api/bookings — historique de la cliente connectée (CLI-02) */
export const GET = route(async () => {
  const user = await requireUser("CLIENT");
  return ok(await listClientBookings(user.id));
});

/**
 * POST /api/bookings — réserver (RES-03). 409 SLOT_TAKEN si le créneau vient d'être pris (RES-04).
 * Corps : { salonSlug, serviceKeys[], employee ("any" ou clé), date, time, paymentMethod, note? }
 */
export const POST = route(async (request) => {
  const user = await requireUser("CLIENT");
  rateLimit("booking", user.id);
  const input = await readJson(request, createBookingInput);
  const booking = await createBooking(user.id, input);
  return ok(booking, { status: 201 });
});
