import { timingSafeEqual } from "node:crypto";
import { ok, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { runScheduledJobs } from "@/modules/scheduler";

/** Secret du cron externe (en-tête Authorization: Bearer …), comparé en temps constant */
function hasCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
}

/** GET|POST /api/cron — tâches planifiées (RES-07, FID-07) : cron avec CRON_SECRET, ou Super Admin connecté */
async function run(request: Request) {
  if (!hasCronSecret(request)) await requireUser("ADMIN");
  return ok(await runScheduledJobs());
}

export const GET = route(run);
export const POST = route(run);
