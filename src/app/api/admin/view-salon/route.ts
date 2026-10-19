import { NextResponse } from "next/server";
import { z } from "zod";
import { notFound } from "@/core/domain/errors";
import { readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { salonExists } from "@/modules/admin";
import { ADMIN_SALON_COOKIE } from "@/modules/dashboard";

const input = z.object({ salonId: z.string().regex(/^[a-f\d]{24}$/i, "Salon invalide") });

/** POST /api/admin/view-salon — { salonId } : le Super Admin ouvre le dashboard de ce salon (ADM-03), choix gardé 8 h */
export const POST = route(async (request) => {
  await requireUser("ADMIN");
  const { salonId } = await readJson(request, input);
  if (!(await salonExists(salonId))) throw notFound("Salon introuvable.");
  const response = NextResponse.json({ data: { salonId } });
  response.cookies.set(ADMIN_SALON_COOKIE, salonId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
});
