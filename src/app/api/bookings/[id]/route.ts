import { bookingActionInput, cancelBooking, rescheduleBooking, setBookingStatus } from "@/modules/booking";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/**
 * PATCH /api/bookings/:id — { action } :
 *  cancel (cliente ou salon, RES-05) · reschedule { date, time } (cliente) ·
 *  start · complete (déclenche les points) · noShow (salon)
 */
export const PATCH = route(async (request, ctx: RouteContext<"/api/bookings/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireUser();
  const input = await readJson(request, bookingActionInput);
  switch (input.action) {
    case "cancel":
      return ok(await cancelBooking(id, actor));
    case "reschedule":
      return ok(await rescheduleBooking(id, actor, input.date, input.time));
    default:
      return ok(await setBookingStatus(id, actor, input.action));
  }
});
