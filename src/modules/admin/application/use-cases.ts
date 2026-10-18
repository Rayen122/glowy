import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { assertAdmin, salonTransition } from "../domain/policy";
import type { AdminRepository } from "./ports";
import type { SalonActionInput, UserActionInput } from "./schemas";

/** Actions du Super Admin — chacune est journalisée (ADM-07) */
export function makeAdmin({ admin, events }: { admin: AdminRepository; events: EventPublisher }) {
  async function setSalonStatus(actor: Actor, salonId: string, input: SalonActionInput) {
    assertAdmin(actor);
    const salon = await admin.findSalon(salonId);
    if (!salon) throw notFound("Salon introuvable.");
    const transition = salonTransition(input.action, salon.status);
    const updated = await admin.updateSalon(
      salonId,
      { status: transition.to, ...(transition.verified !== undefined ? { verified: transition.verified } : {}) },
      { actorId: actor.id, action: `salon.${input.action}`, targetType: "Salon", targetId: salonId, meta: { name: salon.name, reason: input.reason ?? null } }
    );
    await events.publish("salon.statusChanged", { salonId, status: updated.status, actorId: actor.id });
    return updated;
  }

  /** ADM-04 : blocage et déblocage d'un compte */
  async function setUserStatus(actor: Actor, userId: string, input: UserActionInput) {
    assertAdmin(actor);
    if (userId === actor.id) throw conflict("SELF_ACTION", "Vous ne pouvez pas bloquer votre propre compte.");
    const user = await admin.findUser(userId);
    if (!user) throw notFound("Utilisateur introuvable.");
    return admin.updateUserStatus(userId, input.action === "block" ? "BLOCKED" : "ACTIVE", {
      actorId: actor.id,
      action: `user.${input.action}`,
      targetType: "User",
      targetId: userId,
      meta: { email: user.email },
    });
  }

  return { setSalonStatus, setUserStatus };
}
