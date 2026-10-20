import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { createSalonReward, listSalonRewards, salonRewardInput } from "@/modules/promotions";

/** GET /api/dashboard/rewards — récompenses fidélité propres au salon (FID-06) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "EMPLOYEE", "ADMIN");
  return ok(await listSalonRewards(await currentSalonId(actor)));
});

/** POST /api/dashboard/rewards — { label, cost, active } */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  return ok(await createSalonReward(await currentSalonId(actor), await readJson(request, salonRewardInput)), { status: 201 });
});
