import { cookies } from "next/headers";
import type { Actor } from "@/core/domain/actor";
import { staffSalonId } from "@/modules/identity";

/**
 * Salon géré dans le dashboard : celui du gérant ou de l'employé ; pour le Super Admin, le salon
 * choisi depuis /admin/salons (ADM-03, « consulter le dashboard de n'importe quel salon »), mémorisé dans un cookie.
 */
export const ADMIN_SALON_COOKIE = "glowy-admin-salon";

export async function currentSalonId(actor: Actor) {
  if (actor.role !== "ADMIN") return staffSalonId(actor);
  let chosen: string | undefined;
  try {
    chosen = (await cookies()).get(ADMIN_SALON_COOKIE)?.value;
  } catch {
    chosen = undefined; // hors requête HTTP (tests, scripts)
  }
  return staffSalonId(actor, chosen && /^[a-f\d]{24}$/i.test(chosen) ? chosen : undefined);
}
