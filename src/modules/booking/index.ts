/**
 * Module Réservation (P3) — API publique.
 * Câblage : cas d'usage ← dépôt MongoDB (verrou par tranches), contrôle d'accès du module Identité, bus d'événements.
 */
import { systemClock, type Clock } from "@/core/domain/clock";
import type { EventSubscriber } from "@/core/domain/events";
import { eventBus } from "@/infrastructure/event-bus";
import { offPeakHoursFor } from "@/modules/affluence";
import { canManageSalon } from "@/modules/identity";
import { notify } from "@/modules/notifications";
import { createPromotionsModule } from "@/modules/promotions";
import { makeBooking } from "./application/use-cases";
import { mongoBookingRepository } from "./infrastructure/mongo-booking-repository";
import { notifyWaitlist } from "./infrastructure/waitlist";

/** Instance avec une autre horloge (tests d'annulation tardive, par exemple) */
export const createBookingModule = (overrides: { clock?: Clock } = {}) => {
  const clock = overrides.clock ?? systemClock;
  return makeBooking({
    bookings: mongoBookingRepository,
    access: { canManageSalon },
    promotions: createPromotionsModule({ clock }),
    offPeak: { hours: offPeakHoursFor },
    events: eventBus,
    clock,
  });
};

export const { resolveServices, getAvailability, availabilityForSalon, quoteBooking, createBooking, cancelBooking, rescheduleBooking, setBookingStatus } = createBookingModule();

export { listClientBookings, salonAgenda, type ClientBooking } from "./infrastructure/queries";
export { createTimeOff, deleteTimeOff } from "./infrastructure/mongo-booking-repository";
export { availabilityQuery, bookingActionInput, bookingQuoteInput, createBookingInput, type CreateBookingInput } from "./application/schemas";
export { ACTIVE_STATUSES, depositFor, isOffPeak, staffActions, type StaffAction } from "./domain/policy";
export type { BookingRecord } from "./application/ports";

/** RES-09 : une annulation libère un créneau → les clientes en liste d'attente de ce jour sont prévenues */
export const registerSubscribers = (bus: EventSubscriber) =>
  bus.on("booking.cancelled", async ({ bookingId }) => {
    await notifyWaitlist(bookingId, {
      notify,
      freeSlots: async (salonId, date, durationMin) => (await getAvailability({ salonId, date, durationMin })).slots.filter((s) => s.employees.length > 0).map((s) => s.time),
    });
  });

export { expireWaitlist, joinWaitlist, leaveWaitlist, myWaitlist } from "./infrastructure/waitlist";
export { waitlistInput } from "./application/schemas";
