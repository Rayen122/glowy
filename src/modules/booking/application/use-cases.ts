import type { Actor } from "@/core/domain/actor";
import type { Clock } from "@/core/domain/clock";
import { badRequest, conflict, forbidden, notFound } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { toMinutes, tunisToUtc, weekdayOf } from "@/core/domain/time";
import { computeSlots, freeEmployees, isFree } from "../domain/availability";
import { depositFor, isActive, isOffPeak, isWithinCancellationWindow, nextStatus, startsTooSoon, type StaffAction } from "../domain/policy";
import type { BookingRepository, SalonAccessPort } from "./ports";
import type { AvailabilityQuery, CreateBookingInput } from "./schemas";

export type BookingDeps = { bookings: BookingRepository; access: SalonAccessPort; events: EventPublisher; clock: Clock };

/**
 * Réservation (P3, RES-03 à RES-05).
 * Anti double réservation (RES-04) : chaque réservation verrouille en base les tranches de 5 min de l'employé
 * (index unique) ; deux demandes simultanées pour le même créneau → une seule réussit, l'autre reçoit SLOT_TAKEN.
 */
export function makeBooking({ bookings, access, events, clock }: BookingDeps) {
  async function resolveServices(salonId: string, keys: string[]) {
    const unique = [...new Set(keys)];
    const services = await bookings.activeServices(salonId, unique);
    if (services.length !== unique.length) throw badRequest("UNKNOWN_SERVICE", "Prestation inconnue pour ce salon.");
    return { services, durationMin: services.reduce((a, s) => a + s.durationMin, 0), total: services.reduce((a, s) => a + s.price, 0) };
  }

  /** Créneaux d'une journée pour une durée donnée (pas de 30 min), avec les employés libres */
  async function getAvailability(params: { salonId: string; date: string; durationMin: number; employeeKey?: string }) {
    const day = await bookings.daySchedule(params.salonId, params.date, { employeeKey: params.employeeKey });
    return computeSlots(day, params.durationMin, clock.now());
  }

  /** GET /api/salons/:slug/availability : prestations choisies → durée → créneaux */
  async function availabilityForSalon(slug: string, query: AvailabilityQuery) {
    const salon = await bookings.salonBySlug(slug);
    if (!salon?.active) throw notFound("Salon introuvable.");
    const keys = query.services?.split(",").filter(Boolean) ?? [];
    const durationMin = keys.length ? (await resolveServices(salon.id, keys)).durationMin : 30;
    const employeeKey = query.employee && query.employee !== "any" ? query.employee : undefined;
    return getAvailability({ salonId: salon.id, date: query.date, durationMin, employeeKey });
  }

  /** RES-03 : réserve un créneau. Avec employee = "any", essaie chaque employé libre dans l'ordre. */
  async function createBooking(clientId: string, input: CreateBookingInput) {
    const now = clock.now();
    const salon = await bookings.salonBySlug(input.salonSlug);
    if (!salon?.active) throw notFound("Salon introuvable.");

    const { services, durationMin, total } = await resolveServices(salon.id, input.serviceKeys);
    const startsAt = tunisToUtc(input.date, input.time);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    if (startsTooSoon(startsAt, now)) throw badRequest("SLOT_IN_PAST", "Ce créneau est déjà passé.");

    const specific = input.employee !== "any";
    const day = await bookings.daySchedule(salon.id, input.date, { employeeKey: specific ? input.employee : undefined });
    if (!day.opening) throw badRequest("SALON_CLOSED", "Le salon est fermé ce jour-là.");
    if (specific && day.employees.length === 0) throw notFound("Professionnel introuvable.");

    const minutes = toMinutes(input.time);
    for (const employee of freeEmployees(day, minutes, durationMin)) {
      const booking = await bookings.insertIfFree({
        clientId,
        salonId: salon.id,
        employeeId: employee.id,
        startsAt,
        endsAt,
        totalPrice: total,
        deposit: depositFor(total, input.paymentMethod, salon.depositPercent),
        paymentMethod: input.paymentMethod,
        note: input.note || null,
        offPeak: isOffPeak(day.weekday, minutes),
        items: services,
      });
      if (booking) {
        await events.publish("booking.created", { bookingId: booking.id });
        return booking;
      }
    }
    throw conflict("SLOT_TAKEN", "Ce créneau n'est plus disponible. Choisissez-en un autre.");
  }

  async function load(bookingId: string) {
    const booking = await bookings.findById(bookingId);
    if (!booking) throw notFound("Rendez-vous introuvable.");
    return booking;
  }

  /** RES-05 : annulation tardive par la cliente (moins de cancellationHours avant) → pénalité, acompte conservé */
  async function cancelBooking(bookingId: string, actor: Actor) {
    const now = clock.now();
    const booking = await load(bookingId);
    const byClient = booking.clientId === actor.id;
    if (!byClient && !(await access.canManageSalon(actor, booking.salonId))) throw forbidden();
    if (!isActive(booking.status)) throw conflict("NOT_CANCELLABLE", "Ce rendez-vous ne peut plus être annulé.");

    const { cancellationHours } = await bookings.salonPolicy(booking.salonId);
    const late = byClient && isWithinCancellationWindow(booking.startsAt, now, cancellationHours);
    const updated = await bookings.cancel(bookingId, now, !late);
    if (!updated) throw conflict("NOT_CANCELLABLE", "Ce rendez-vous ne peut plus être annulé.");
    await events.publish("booking.cancelled", { bookingId, late, by: byClient ? "client" : "salon" });
    return { booking: updated, late };
  }

  /** RES-05 : report par la cliente — même employé, même durée, avant la limite d'annulation */
  async function rescheduleBooking(bookingId: string, actor: Actor, date: string, time: string) {
    const now = clock.now();
    const booking = await load(bookingId);
    if (booking.clientId !== actor.id) throw forbidden();
    if (!isActive(booking.status)) throw conflict("NOT_RESCHEDULABLE", "Ce rendez-vous ne peut plus être reporté.");
    const { cancellationHours } = await bookings.salonPolicy(booking.salonId);
    if (isWithinCancellationWindow(booking.startsAt, now, cancellationHours)) {
      throw conflict("TOO_LATE", `Report possible jusqu'à ${cancellationHours} h avant le rendez-vous.`);
    }

    const durationMin = (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000;
    const startsAt = tunisToUtc(date, time);
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    if (startsTooSoon(startsAt, now)) throw badRequest("SLOT_IN_PAST", "Ce créneau est déjà passé.");

    const day = await bookings.daySchedule(booking.salonId, date, { employeeId: booking.employeeId, ignoreBookingId: booking.id });
    const employee = day.employees[0];
    if (!employee || !isFree(day, employee, toMinutes(time), durationMin)) throw conflict("SLOT_TAKEN", "Ce créneau n'est pas disponible.");

    const moved = await bookings.moveIfFree(booking.id, startsAt, endsAt, isOffPeak(weekdayOf(date), toMinutes(time)));
    if (!moved) throw conflict("SLOT_TAKEN", "Ce créneau n'est pas disponible.");
    return moved;
  }

  /** Suivi par le salon : en cours, terminé (déclenche les points, AVI-01) ou absent (pénalité) */
  async function setBookingStatus(bookingId: string, actor: Actor, action: StaffAction) {
    const booking = await load(bookingId);
    if (!(await access.canManageSalon(actor, booking.salonId))) throw forbidden();
    const to = nextStatus(action, booking.status);
    if (!to) throw conflict("INVALID_TRANSITION", "Changement de statut impossible.");

    const updated = await bookings.setStatus(bookingId, booking.status, to, clock.now());
    if (!updated) throw conflict("INVALID_TRANSITION", "Changement de statut impossible.");
    if (to === "COMPLETED") await events.publish("booking.completed", { bookingId });
    if (to === "NO_SHOW") await events.publish("booking.noShow", { bookingId });
    return updated;
  }

  return { resolveServices, getAvailability, availabilityForSalon, createBooking, cancelBooking, rescheduleBooking, setBookingStatus };
}

export type BookingUseCases = ReturnType<typeof makeBooking>;
