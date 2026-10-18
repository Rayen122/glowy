import { cache } from "react";
import { listClientBookings } from "@/modules/booking";
import { getAccount } from "@/modules/loyalty";
import { objectId, PhotoAnalysis } from "@/infrastructure/db";
import { getProfile } from "./profile";

/** Données de l'espace client (P5) — mises en cache le temps d'une requête (layout + page). */

export const getAccountSummary = cache(async (userId: string) => {
  const now = Date.now();
  const [profile, account, bookings] = await Promise.all([getProfile(userId), getAccount(userId), listClientBookings(userId)]);
  const upcoming = bookings
    .filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING" || b.status === "IN_PROGRESS") && b.endsAt.getTime() >= now)
    .reverse();
  return {
    profile,
    account,
    bookings,
    /** Classement pour l'interface (à venir, passés, annulés) */
    upcoming,
    past: bookings.filter((b) => b.status === "COMPLETED" || b.status === "NO_SHOW"),
    cancelled: bookings.filter((b) => b.status === "CANCELLED"),
    next: upcoming.find((b) => b.startsAt.getTime() > now) ?? null,
    toReview: bookings.find((b) => b.status === "COMPLETED" && !b.review) ?? null,
  };
});

export type AccountBooking = Awaited<ReturnType<typeof listClientBookings>>[number];

/** Dernière analyse photo de la cliente (P5) : date seulement, pour l'aperçu du compte */
export async function lastPhotoAnalysis(userId: string) {
  const analysis = await PhotoAnalysis.findOne({ user: objectId(userId) }, { createdAt: 1 }).sort({ createdAt: -1 }).lean();
  return analysis ? { createdAt: analysis.createdAt } : null;
}
