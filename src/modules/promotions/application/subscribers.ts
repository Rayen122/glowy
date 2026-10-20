import type { EventSubscriber } from "@/core/domain/events";

/** FID-06 : une visite terminée crédite les points salon (une seule fois par réservation) */
export function registerPromotionSubscribers(bus: EventSubscriber, deps: { creditVisit: (bookingId: string) => Promise<unknown> }) {
  bus.on("booking.completed", async ({ bookingId }) => {
    await deps.creditVisit(bookingId);
  });
}
