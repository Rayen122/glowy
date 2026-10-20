import { ok, readJson, route } from "@/infrastructure/http";
import { currentActor } from "@/infrastructure/session";
import { chat, chatInput } from "@/modules/assistant";

/**
 * POST /api/ai/chat — { message, salonSlug? } → réponse structurée de l'assistante (IA P3) :
 * créneaux réellement libres, réponse à une question fréquente, ou repli vers le formulaire.
 * Aucune réservation ici : elle se fait après confirmation, par POST /api/bookings.
 */
export const POST = route(async (request) => {
  const actor = await currentActor();
  return ok(await chat(await readJson(request, chatInput), actor?.role === "CLIENT" ? actor.id : undefined));
});
