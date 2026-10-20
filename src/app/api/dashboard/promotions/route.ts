import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { createPromotion, listSalonPromotions, promotionInput } from "@/modules/promotions";

/** GET /api/dashboard/promotions — codes promo et offres de dernière minute du salon (SAL-10) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await listSalonPromotions(await currentSalonId(actor)));
});

/** POST /api/dashboard/promotions — { kind, code?, label, percent | amount, minTotal, startsOn, endsOn, withinHours?, maxUses, active } */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await createPromotion(await currentSalonId(actor), await readJson(request, promotionInput)), { status: 201 });
});
