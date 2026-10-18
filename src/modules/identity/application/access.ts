import type { Actor } from "@/core/domain/actor";
import { forbidden } from "@/core/domain/errors";
import type { StaffDirectory } from "./ports";

/**
 * Périmètre du personnel (cahier §10) : le gérant ne voit que son salon, l'employé que le salon
 * qui l'emploie ; le Super Admin peut consulter n'importe quel salon (ADM-03).
 */
export function makeAccess(directory: StaffDirectory) {
  async function staffSalonId(actor: Actor, requestedSalonId?: string) {
    switch (actor.role) {
      case "ADMIN": {
        const id = requestedSalonId ?? (await directory.firstActiveSalonId());
        if (!id) throw forbidden("Aucun salon actif.");
        return id;
      }
      case "MANAGER": {
        const id = await directory.ownedSalonId(actor.id, requestedSalonId);
        if (!id) throw forbidden("Ce salon ne vous appartient pas.");
        return id;
      }
      case "EMPLOYEE": {
        const id = await directory.employerSalonId(actor.id);
        if (!id || (requestedSalonId && id !== requestedSalonId)) throw forbidden();
        return id;
      }
      default:
        throw forbidden();
    }
  }

  async function canManageSalon(actor: Actor, salonId: string) {
    try {
      return (await staffSalonId(actor, salonId)) === salonId;
    } catch {
      return false;
    }
  }

  return { staffSalonId, canManageSalon };
}

export type SalonAccess = ReturnType<typeof makeAccess>;
