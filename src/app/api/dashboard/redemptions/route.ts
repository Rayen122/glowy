import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { redeemAtCounter, redemptionCodeInput } from "@/modules/promotions";

/** POST /api/dashboard/redemptions — { code } : validation au comptoir du code de récompense de la cliente (FID-06) */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  const { code } = await readJson(request, redemptionCodeInput);
  return ok(await redeemAtCounter(await currentSalonId(actor), code));
});
