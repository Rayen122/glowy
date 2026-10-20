/**
 * Démarrage du serveur Next.js : planificateur interne des tâches (rappels RES-07, expiration des points FID-07),
 * toutes les 10 minutes. Désactivable avec SCHEDULER=off (par exemple quand un cron externe appelle /api/cron).
 */
const EVERY_MS = 10 * 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SCHEDULER === "off") return;
  const state = globalThis as typeof globalThis & { __glowyScheduler?: NodeJS.Timeout };
  if (state.__glowyScheduler) return; // un seul minuteur, même après un rechargement à chaud
  const tick = async () => {
    try {
      const { runScheduledJobs } = await import("@/modules/scheduler");
      const run = await runScheduledJobs();
      if (run.reminders || run.warned || run.expired) console.info("[planificateur]", run);
    } catch (error) {
      console.error("[planificateur] échec", error);
    }
  };
  state.__glowyScheduler = setInterval(() => void tick(), EVERY_MS);
  state.__glowyScheduler.unref?.();
}
