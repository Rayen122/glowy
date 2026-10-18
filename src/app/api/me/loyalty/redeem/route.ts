import { z } from "zod";
import { redeem } from "@/modules/loyalty";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";

/** POST /api/me/loyalty/redeem — { rewardId } : échange de points (FID-04), renvoie le code */
export const POST = route(async (request) => {
  const user = await requireUser("CLIENT");
  const { rewardId } = await readJson(request, z.object({ rewardId: z.string().min(1) }));
  return ok(await redeem(user.id, rewardId), { status: 201 });
});
