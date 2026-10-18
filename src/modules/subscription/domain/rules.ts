import type { PlanId } from "@/core/domain/enums";

/** Abonnements des salons (ADM-05) — règles pures */

/** Durée d'une période payée */
export const PLAN_PERIOD_DAYS = 30;
/** Un plan encore actif peut être renouvelé seulement à moins de 7 jours de son échéance */
export const RENEW_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

/** Fin de la nouvelle période : prolongation à partir de l'échéance si le même plan est encore actif, sinon à partir de maintenant */
export const paidUntil = (now: Date, currentUntil: Date | null) => {
  const start = currentUntil && currentUntil.getTime() > now.getTime() ? currentUntil : now;
  return new Date(start.getTime() + PLAN_PERIOD_DAYS * DAY_MS);
};

/** Nombre de jours restants de la période payée (0 si expirée ou plan gratuit) */
export const daysLeft = (planUntil: Date | null, now: Date) => (planUntil ? Math.max(0, Math.ceil((planUntil.getTime() - now.getTime()) / DAY_MS)) : 0);

/** Le plan demandé est déjà actif et loin de son échéance : inutile de repayer */
export const isAlreadyCovered = (salon: { plan: PlanId; planUntil: Date | null }, requested: PlanId, now: Date) =>
  salon.plan === requested && daysLeft(salon.planUntil, now) > RENEW_WINDOW_DAYS;
