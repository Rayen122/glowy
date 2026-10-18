import { conflict, notFound } from "@/core/domain/errors";
import type { BookingStatus, ReportStatus, ReviewStatus } from "@/core/domain/enums";

/** Avis vérifiés (P4, AVI-01 à AVI-06) — règles pures. */

/** AVI-01 : un avis n'est possible qu'après un rendez-vous terminé, par la cliente, une seule fois */
export function assertCanReview(booking: { clientId: string; status: BookingStatus; reviewed: boolean } | null, clientId: string) {
  if (!booking || booking.clientId !== clientId) throw notFound("Rendez-vous introuvable.");
  if (booking.status !== "COMPLETED") throw conflict("BOOKING_NOT_COMPLETED", "Vous pourrez donner votre avis après le rendez-vous.");
  if (booking.reviewed) throw conflict("ALREADY_REVIEWED", "Vous avez déjà donné votre avis sur ce rendez-vous.");
}

/** Note moyenne affichée : une décimale */
export const roundRating = (average: number | null | undefined) => Math.round((average ?? 0) * 10) / 10;

/** AVI-06 : décision du Super Admin sur un avis signalé */
export const MODERATION = {
  hide: { review: "HIDDEN", reports: "HIDDEN" },
  keep: { review: "PUBLISHED", reports: "KEPT" },
} as const satisfies Record<string, { review: ReviewStatus; reports: ReportStatus }>;
