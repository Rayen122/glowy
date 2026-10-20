import { ok, readQuery, route } from "@/infrastructure/http";
import { bookingQuoteInput, quoteBooking } from "@/modules/booking";

/**
 * GET /api/salons/:slug/quote?services=cle1,cle2&date=AAAA-MM-JJ&time=HH:MM&code=PROMO&paymentMethod=ONLINE
 * Prix avant confirmation : remise de dernière minute automatique ou code promo (SAL-10), acompte.
 */
export const GET = route(async (request, ctx: RouteContext<"/api/salons/[slug]/quote">) => {
  const { slug } = await ctx.params;
  return ok(await quoteBooking(slug, readQuery(request, bookingQuoteInput)));
});
