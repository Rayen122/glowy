import { PLANS, type PlanId } from "@/core/domain/enums";

/**
 * Ce que chaque plan débloque (page /pro) — règles pures. Vérifiées côté serveur : une fonction réservée renvoie
 * PLAN_REQUIRED, l'interface affiche alors « Disponible avec le plan … ».
 */
export const PLAN_FEATURES = ["agendaViews", "crm", "stats", "promotions", "affluence", "stocks", "branches", "highlight"] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

const PRO_FEATURES: PlanFeature[] = ["agendaViews", "crm", "stats", "promotions", "affluence"];

export const PLAN_LIMITS: Record<PlanId, { maxEmployees: number | null; features: readonly PlanFeature[] }> = {
  gratuit: { maxEmployees: 1, features: [] },
  pro: { maxEmployees: 8, features: PRO_FEATURES },
  premium: { maxEmployees: null, features: [...PRO_FEATURES, "stocks", "branches", "highlight"] },
};

/** Plan réellement en vigueur : un plan payant dont la période est terminée redevient Gratuit */
export const effectivePlan = (plan: PlanId, planUntil: Date | null, now: Date): PlanId =>
  plan !== "gratuit" && planUntil && planUntil.getTime() > now.getTime() ? plan : "gratuit";

export const planAllows = (plan: PlanId, feature: PlanFeature) => PLAN_LIMITS[plan].features.includes(feature);

/** Plus petit plan qui débloque la fonction */
export const minimumPlanFor = (feature: PlanFeature): PlanId => PLANS.find((plan) => planAllows(plan, feature)) ?? "premium";

/** Le salon peut-il activer un professionnel de plus ? */
export const canAddEmployee = (plan: PlanId, activeEmployees: number) => {
  const max = PLAN_LIMITS[plan].maxEmployees;
  return max === null || activeEmployees < max;
};

/** Rappel avant l'échéance d'un plan payant */
export const PLAN_REMINDER_DAYS = 5;
