/**
 * Tâches planifiées (cron) : expiration des demandes jamais confirmées, rappels de rendez-vous (RES-07), préavis puis expiration des points (FID-07),
 * analyse des avis pas encore analysés (IA P4), rappel puis fin des plans payants arrivés à échéance (ADM-05),
 * brouillons des fiches de paie en fin de mois.
 * Lancées toutes les 10 minutes par le serveur (src/instrumentation.ts), par GET /api/cron avec le secret
 * CRON_SECRET (cron externe, Vercel Cron…), ou à la main par le Super Admin. Chaque tâche est idempotente.
 */
import { expireStaleRequests, expireWaitlist } from "./booking";
import { expireInactivePoints, warnExpiringPoints } from "./loyalty";
import { sendReminders } from "./notifications";
import { ensureMonthlyPayslips } from "./payroll";
import { analyzeMissingReviews } from "./reviews";
import { expirePlans, remindExpiringPlans } from "./subscription";

export async function runScheduledJobs(now = new Date()) {
  const requestsExpired = await expireStaleRequests();
  const reminders = await sendReminders(now);
  const warned = await warnExpiringPoints();
  const expired = await expireInactivePoints();
  const reviewsAnalyzed = await analyzeMissingReviews();
  const waitlistExpired = await expireWaitlist(now);
  const plansReminded = await remindExpiringPlans(now);
  const plansExpired = await expirePlans(now);
  const payslips = await ensureMonthlyPayslips(now);
  return { at: now.toISOString(), requestsExpired, reminders, warned, expired, reviewsAnalyzed, waitlistExpired, plansReminded, plansExpired, payslips };
}

export type ScheduledRun = Awaited<ReturnType<typeof runScheduledJobs>>;
