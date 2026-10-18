import type { DomainEvents, EventHandler, EventName, EventPublisher, EventSubscriber } from "@/core/domain/events";

/**
 * Bus d'événements en mémoire (même processus). Les abonnés sont déclarés par chaque module
 * et chargés au premier événement (src/modules/subscribers.ts). Une erreur d'abonné est journalisée
 * sans annuler l'action d'origine.
 */
type AnyHandler = (payload: never) => Promise<void> | void;

const handlers = new Map<EventName, AnyHandler[]>();
let subscribersLoaded: Promise<unknown> | null = null;

export const eventBus: EventPublisher & EventSubscriber = {
  on<E extends EventName>(event: E, handler: EventHandler<E>) {
    handlers.set(event, [...(handlers.get(event) ?? []), handler as AnyHandler]);
  },
  async publish<E extends EventName>(event: E, payload: DomainEvents[E]) {
    subscribersLoaded ??= import("@/modules/subscribers");
    await subscribersLoaded;
    for (const handler of (handlers.get(event) ?? []) as EventHandler<E>[]) {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[events] ${event} : un abonné a échoué`, error);
      }
    }
  },
};
