import { cookies } from "next/headers";
import type { Actor } from "@/core/domain/actor";
import { staffSalonId } from "@/modules/identity";

/**
 * Salon géré dans le dashboard : celui du gérant ou de l'employé ; pour le Super Admin, le salon
 * choisi depuis /admin/salons (ADM-03, « consulter le dashboard de n'importe quel salon »), mémorisé dans un cookie.
 */
export const ADMIN_SALON_COOKIE = "glowy-admin-salon";

/** Succursale pilotée par un gérant qui en a plusieurs (SAL-14) */
export const BRANCH_COOKIE = "glowy-branch";

async function cookieValue(name: string) {
  try {
    const value = (await cookies()).get(name)?.value;
    return value && /^[a-f\d]{24}$/i.test(value) ? value : undefined;
  } catch {
    return undefined; // hors requête HTTP (tests, scripts)
  }
}

export async function currentSalonId(actor: Actor) {
  if (actor.role === "ADMIN") return staffSalonId(actor, await cookieValue(ADMIN_SALON_COOKIE));
  if (actor.role === "MANAGER") {
    const chosen = await cookieValue(BRANCH_COOKIE);
    // Succursale choisie si elle lui appartient toujours, sinon son premier salon
    if (chosen) return staffSalonId(actor, chosen).catch(() => staffSalonId(actor));
  }
  return staffSalonId(actor);
}
