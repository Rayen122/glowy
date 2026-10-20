import type { BookingStatus, PaymentMethod } from "@/core/domain/enums";

/** Règles de réservation (P3, RES-03 à RES-05) — fonctions pures, testées sans base de données. */

/** Statuts qui occupent l'agenda d'un employé */
export const ACTIVE_STATUSES: readonly BookingStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS"];
export const isActive = (status: BookingStatus) => ACTIVE_STATUSES.includes(status);

/** Pas des créneaux proposés */
export const SLOT_STEP_MIN = 30;
/** Délai minimal entre maintenant et le début d'un créneau réservable */
export const MIN_LEAD_MIN = 15;
/** Grain du verrou anti double réservation (durées et horaires multiples de 5 min) */
export const LOCK_GRAIN_MIN = 5;

/**
 * Heure creuse (+10 pts) : heures prévues calmes par la prédiction d'affluence du salon (IA P2) ;
 * repli quand le salon n'a pas assez d'historique : lun.–mer., 10 h – 12 h.
 */
export const isOffPeak = (weekday: number, minutes: number, forecastHours?: number[] | null) =>
  forecastHours ? forecastHours.includes(Math.floor(minutes / 60)) : weekday >= 1 && weekday <= 3 && minutes >= 600 && minutes < 720;

/**
 * Acompte en ligne : `percent` % du total réglé par le salon (SAL-07, 20 % par défaut, 0 = pas d'acompte),
 * borné entre 10 et 30 DT et jamais au-delà du total. Même règle dans le tunnel de réservation.
 */
export const depositFor = (total: number, method: PaymentMethod, percent = 20) =>
  method === "ONLINE" && total > 0 && percent > 0 ? Math.min(total, 30, Math.max(10, Math.round((total * percent) / 100))) : 0;

/** Le créneau commence-t-il trop tôt pour être encore réservé ? */
export const startsTooSoon = (startsAt: Date, now: Date) => startsAt.getTime() < now.getTime() + MIN_LEAD_MIN * 60_000;

/** Annulation ou report à moins de `cancellationHours` du rendez-vous = tardif (RES-05) */
export const isWithinCancellationWindow = (startsAt: Date, now: Date, cancellationHours: number) =>
  startsAt.getTime() - now.getTime() < cancellationHours * 3_600_000;

/** Suivi du rendez-vous par le salon */
export const TRANSITIONS = {
  start: { from: ["PENDING", "CONFIRMED"], to: "IN_PROGRESS" },
  complete: { from: ["CONFIRMED", "IN_PROGRESS"], to: "COMPLETED" },
  noShow: { from: ["PENDING", "CONFIRMED"], to: "NO_SHOW" },
} as const satisfies Record<string, { from: readonly BookingStatus[]; to: BookingStatus }>;

export type StaffAction = keyof typeof TRANSITIONS;

/** Statut d'arrivée, ou null si le changement est interdit depuis le statut actuel */
export function nextStatus(action: StaffAction, current: BookingStatus): BookingStatus | null {
  const transition = TRANSITIONS[action];
  return (transition.from as readonly BookingStatus[]).includes(current) ? transition.to : null;
}

/** Tranches de LOCK_GRAIN_MIN minutes couvertes par [start, end[ — clés du verrou en base */
export function lockSlices(start: Date, end: Date) {
  const grain = LOCK_GRAIN_MIN * 60_000;
  const slices: Date[] = [];
  for (let t = Math.floor(start.getTime() / grain) * grain; t < end.getTime(); t += grain) slices.push(new Date(t));
  return slices;
}
