/**
 * Module Réservation (P3) — API publique.
 * Câblage : cas d'usage ← dépôt MongoDB (verrou par tranches), contrôle d'accès du module Identité, bus d'événements.
 */
import { systemClock, type Clock } from "@/core/domain/clock";
import { eventBus } from "@/infrastructure/event-bus";
import { canManageSalon } from "@/modules/identity";
import { createPromotionsModule } from "@/modules/promotions";
import { makeBooking } from "./application/use-cases";
import { mongoBookingRepository } from "./infrastructure/mongo-booking-repository";

/** Instance avec une autre horloge (tests d'annulation tardive, par exemple) */
export const createBookingModule = (overrides: { clock?: Clock } = {}) => {
  const clock = overrides.clock ?? systemClock;
  return makeBooking({ bookings: mongoBookingRepository, access: { canManageSalon }, promotions: createPromotionsModule({ clock }), events: eventBus, clock });
};

export const { resolveServices, getAvailability, availabilityForSalon, quoteBooking, createBooking, cancelBooking, rescheduleBooking, setBookingStatus } = createBookingModule();

export { listClientBookings, salonAgenda, type ClientBooking } from "./infrastructure/queries";
export { createTimeOff, deleteTimeOff } from "./infrastructure/mongo-booking-repository";
export { availabilityQuery, bookingActionInput, bookingQuoteInput, createBookingInput, type CreateBookingInput } from "./application/schemas";
export { ACTIVE_STATUSES, depositFor, isOffPeak } from "./domain/policy";
export type { BookingRecord } from "./application/ports";
