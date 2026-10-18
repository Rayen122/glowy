import { ok, route } from "@/infrastructure/http";
import { pingDb } from "@/infrastructure/db";

/** GET /api/health — état de l'application et de la base (supervision, CI) */
export const GET = route(async () => {
  await pingDb();
  return ok({ status: "ok", database: "up", time: new Date().toISOString() });
});
