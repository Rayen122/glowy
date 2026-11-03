import { conflict, notFound } from "@/core/domain/errors";
import type { BookingStatus, ReportStatus, ReviewStatus } from "@/core/domain/enums";

/** Avis vérifiés (P4, AVI-01 à AVI-06) — règles pures. */

/**
 * AVI-01 (avis vérifié) : la cliente peut donner son avis dès que l'heure de son rendez-vous est passée, sans attendre
 * que le salon le marque « terminé ». Jamais sur un rendez-vous annulé ou une absence, ni avant l'heure.
 */
export const canReview = (booking: { status: BookingStatus; startsAt: Date }, now: Date) =>
  booking.status === "COMPLETED" || (["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(booking.status) && booking.startsAt.getTime() <= now.getTime());

/** Par la cliente du rendez-vous, une seule fois */
export function assertCanReview(booking: { clientId: string; status: BookingStatus; startsAt: Date; reviewed: boolean } | null, clientId: string, now: Date) {
  if (!booking || booking.clientId !== clientId) throw notFound("Rendez-vous introuvable.");
  if (!canReview(booking, now)) throw conflict("BOOKING_NOT_COMPLETED", "Vous pourrez donner votre avis à partir de l'heure du rendez-vous.");
  if (booking.reviewed) throw conflict("ALREADY_REVIEWED", "Vous avez déjà donné votre avis sur ce rendez-vous.");
}

/** Note moyenne affichée : une décimale */
export const roundRating = (average: number | null | undefined) => Math.round((average ?? 0) * 10) / 10;

/** AVI-06 : décision du Super Admin sur un avis signalé */
export const MODERATION = {
  hide: { review: "HIDDEN", reports: "HIDDEN" },
  keep: { review: "PUBLISHED", reports: "KEPT" },
} as const satisfies Record<string, { review: ReviewStatus; reports: ReportStatus }>;
