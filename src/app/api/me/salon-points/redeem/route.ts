import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { redeemSalonReward, salonRewardRedeemInput } from "@/modules/promotions";

/** POST /api/me/salon-points/redeem — { rewardId } : échange de points salon contre une récompense du salon (FID-06) */
export const POST = route(async (request) => {
  const actor = await requireUser("CLIENT");
  const { rewardId } = await readJson(request, salonRewardRedeemInput);
  return ok(await redeemSalonReward(actor.id, rewardId), { status: 201 });
});
