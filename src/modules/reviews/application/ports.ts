import type { Actor } from "@/core/domain/actor";
import type { BookingStatus, ReportSource, ReviewStatus } from "@/core/domain/enums";
import type { CreateReviewInput } from "./schemas";

export type ReviewRecord = { id: string; bookingId: string; clientId: string; salonId: string; rating: number; text: string; status: ReviewStatus; reply: string | null };

export interface ReviewRepository {
  bookingForReview(bookingId: string): Promise<{ clientId: string; salonId: string; employeeId: string; status: BookingStatus; reviewed: boolean } | null>;
  create(data: Omit<CreateReviewInput, "bookingId"> & { bookingId: string; clientId: string; salonId: string; employeeId: string }): Promise<ReviewRecord>;
  findById(id: string): Promise<ReviewRecord | null>;
  reply(id: string, text: string, at: Date): Promise<ReviewRecord>;
  report(data: { reviewId: string; reporterId: string; source: ReportSource; reason: string }): Promise<{ id: string }>;
  /** Décision finale : statut de l'avis + signalements résolus + journal d'audit, d'un seul tenant */
  moderate(id: string, decision: "hide" | "keep", actorId: string, at: Date): Promise<ReviewRecord>;
  /** Note moyenne et nombre d'avis publiés du salon (dénormalisés pour la recherche) */
  refreshSalonRating(salonId: string): Promise<void>;
}

export interface SalonAccessPort {
  canManageSalon(actor: Actor, salonId: string): Promise<boolean>;
}
