import { ok, readJson, route } from "@/infrastructure/http";
import { requireUser } from "@/infrastructure/session";
import { currentSalonId } from "@/modules/dashboard";
import { myTickets, openTicket, ticketInput } from "@/modules/support";

/** GET /api/support — mes tickets (AVI-07) */
export const GET = route(async () => ok(await myTickets(await requireUser("CLIENT", "MANAGER", "EMPLOYEE"))));

/** POST /api/support — { subject, category, text } : ouvre un ticket (rattaché au salon pour l'équipe d'un salon) */
export const POST = route(async (request) => {
  const actor = await requireUser("CLIENT", "MANAGER", "EMPLOYEE");
  const salonId = actor.role === "CLIENT" ? null : await currentSalonId(actor);
  return ok(await openTicket(actor, salonId, await readJson(request, ticketInput)), { status: 201 });
});
