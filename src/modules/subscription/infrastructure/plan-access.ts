import { AppError } from "@/core/domain/errors";
import type { PlanId } from "@/core/domain/enums";
import { Employee, objectId, Salon } from "@/infrastructure/db";
import { canAddEmployee, effectivePlan, minimumPlanFor, PLAN_LIMITS, planAllows, type PlanFeature } from "../domain/plans";

const PLAN_NAMES: Record<PlanId, string> = { gratuit: "Gratuit", pro: "Pro", premium: "Premium" };

/** Plan en vigueur d'un salon (échéance comprise) */
export async function salonPlan(salonId: string, now = new Date()): Promise<PlanId> {
  const salon = await Salon.findById(objectId(salonId), { plan: 1, planUntil: 1 }).lean();
  return salon ? effectivePlan(salon.plan, salon.planUntil ?? null, now) : "gratuit";
}

/** Fonctions débloquées pour l'interface du dashboard */
export async function planAccess(salonId: string, now = new Date()) {
  const plan = await salonPlan(salonId, now);
  return { plan, maxEmployees: PLAN_LIMITS[plan].maxEmployees, features: [...PLAN_LIMITS[plan].features] };
}

/** 403 PLAN_REQUIRED si le plan du salon ne comprend pas la fonction */
export async function requirePlanFeature(salonId: string, feature: PlanFeature) {
  if (planAllows(await salonPlan(salonId), feature)) return;
  const needed = minimumPlanFor(feature);
  throw new AppError(403, "PLAN_REQUIRED", `Fonction disponible avec le plan ${PLAN_NAMES[needed]}.`, { plan: needed, feature });
}

/** 409 PLAN_LIMIT si le salon a déjà le nombre maximal de professionnels actifs pour son plan */
export async function requireEmployeeSlot(salonId: string) {
  const plan = await salonPlan(salonId);
  const active = await Employee.countDocuments({ salon: objectId(salonId), active: true });
  if (canAddEmployee(plan, active)) return;
  const max = PLAN_LIMITS[plan].maxEmployees;
  throw new AppError(409, "PLAN_LIMIT", `Le plan ${PLAN_NAMES[plan]} permet ${max} professionnel${max === 1 ? "" : "s"} actif${max === 1 ? "" : "s"}. Passez au plan supérieur pour en ajouter.`, { plan, max });
}
