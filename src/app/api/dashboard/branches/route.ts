import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { branchInput, createBranch, listBranches, requireFeature } from "@/modules/dashboard";

/** GET /api/dashboard/branches — succursales du gérant avec leurs chiffres (SAL-14) */
export const GET = route(async () => ok(await listBranches(await requireUser("MANAGER"))));

/** POST /api/dashboard/branches — { name, city, address, phone? } : nouvelle succursale, à valider par le Super Admin */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER");
  await requireFeature(actor, "branches");
  return ok(await createBranch(actor, await readJson(request, branchInput)), { status: 201 });
});
