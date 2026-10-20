/**
 * Tâches planifiées (cron) : rappels de rendez-vous (RES-07), préavis puis expiration des points (FID-07).
 * Lancées toutes les 10 minutes par le serveur (src/instrumentation.ts), par GET /api/cron avec le secret
 * CRON_SECRET (cron externe, Vercel Cron…), ou à la main par le Super Admin. Chaque tâche est idempotente.
 */
import { expireInactivePoints, warnExpiringPoints } from "./loyalty";
import { sendReminders } from "./notifications";

export async function runScheduledJobs(now = new Date()) {
  const reminders = await sendReminders(now);
  const warned = await warnExpiringPoints();
  const expired = await expireInactivePoints();
  return { at: now.toISOString(), reminders, warned, expired };
}

export type ScheduledRun = Awaited<ReturnType<typeof runScheduledJobs>>;
