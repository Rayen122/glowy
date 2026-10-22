import { NextResponse } from "next/server";
import { readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { assertOwnBranch, BRANCH_COOKIE, branchSwitchInput } from "@/modules/dashboard";

/** POST /api/dashboard/branches/switch — { salonId } : le gérant pilote cette succursale (choix gardé 1 an) */
export const POST = route(async (request) => {
  const actor = await requireUser("MANAGER");
  const salonId = await assertOwnBranch(actor, (await readJson(request, branchSwitchInput)).salonId);
  const response = NextResponse.json({ data: { salonId } });
  response.cookies.set(BRANCH_COOKIE, salonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return response;
});
