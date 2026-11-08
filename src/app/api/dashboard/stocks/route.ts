import { z } from "zod";
import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { createProduct, currentSalonId, listProducts, productInput, requireFeature } from "@/modules/dashboard";

/** GET /api/dashboard/stocks — produits, alertes de stock bas et derniers mouvements (SAL-12) */
export const GET = route(async () => {
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stocks");
  return ok(await listProducts(await currentSalonId(actor)));
});

/** POST /api/dashboard/stocks — { name, usage, unit, threshold, price, quantity } */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER", "ADMIN");
  await requireFeature(actor, "stocks");
  const input = await readJson(request, productInput.extend({ quantity: z.coerce.number().int().min(0).max(100_000).default(0) }));
  const { quantity, ...product } = input;
  return ok(await createProduct(await currentSalonId(actor), product, quantity), { status: 201 });
});
