/**
 * Contrat des événements métier (cahier §3.7 : « les modules communiquent par événements »).
 * Un module publie, les autres réagissent sans que l'émetteur les connaisse.
 * Implémentation : src/infrastructure/event-bus.ts ; abonnés : modules/<module>/application/subscribers.ts.
 */
export type DomainEvents = {
  "user.registered": { userId: string };
  "salon.registered": { salonId: string; ownerId: string; plan: string };
  "salon.statusChanged": { salonId: string; status: string; actorId: string };
  "plan.paymentRequested": { paymentId: string; salonId: string };
  "plan.paymentDecided": { paymentId: string; salonId: string; accepted: boolean; actorId: string };
  "booking.created": { bookingId: string };
  /** Le salon a accepté la demande */
  "booking.confirmed": { bookingId: string };
  "booking.cancelled": { bookingId: string; late: boolean; by: "client" | "salon" };
  "booking.completed": { bookingId: string };
  "booking.noShow": { bookingId: string };
  "review.published": { reviewId: string };
};

export type EventName = keyof DomainEvents;
export type EventHandler<E extends EventName> = (payload: DomainEvents[E]) => Promise<void> | void;

export interface EventPublisher {
  publish<E extends EventName>(event: E, payload: DomainEvents[E]): Promise<void>;
}

export interface EventSubscriber {
  on<E extends EventName>(event: E, handler: EventHandler<E>): void;
}
