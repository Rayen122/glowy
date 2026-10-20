import type { PointReason } from "@/core/domain/enums";
import type { CompletedBookingFacts } from "../domain/rules";

export type LedgerEntry = { userId: string; points: number; reason: PointReason; salonId?: string; bookingId?: string; reviewId?: string; label?: string; at: Date };

export interface LoyaltyRepository {
  rule(reason: PointReason): Promise<{ points: number; active: boolean; monthlyCap: number | null; dailyCap: number | null } | null>;
  /** Lignes du grand livre pour cette raison depuis `since` (plafonds mensuels), éventuellement dans un salon */
  countSince(userId: string, reason: PointReason, since: Date, salonId?: string): Promise<number>;
  hasEntry(userId: string, reason: PointReason, ref?: { bookingId?: string; reviewId?: string }): Promise<boolean>;
  account(userId: string): Promise<{ balance: number; lifetime: number; lastActivityAt: Date }>;
  /** Ligne du grand livre + solde (jamais négatif) + cumul, d'un seul tenant */
  record(entry: LedgerEntry): Promise<void>;
  reward(id: string): Promise<{ id: string; label: string; cost: number; active: boolean } | null>;
  /** Décrément conditionnel (solde ≥ coût) + grand livre + échange ; null si le solde est insuffisant */
  redeem(userId: string, reward: { id: string; label: string; cost: number }, code: string, at: Date): Promise<{ id: string; code: string; points: number } | null>;
  staleAccounts(before: Date): Promise<{ userId: string; balance: number }[]>;
  /** Comptes inactifs depuis `before` (mais pas encore expirés) et pas encore prévenus depuis leur dernière activité */
  expiringAccounts(before: Date, notBefore: Date): Promise<{ userId: string; balance: number; lastActivityAt: Date }[]>;
  markExpiryWarned(userId: string, at: Date): Promise<void>;
}

/** Lectures dans les autres modules nécessaires aux réactions « fidélité » */
export interface LoyaltyFacts {
  /** null si le rendez-vous n'est pas (ou plus) terminé */
  completedBooking(bookingId: string): Promise<CompletedBookingFacts | null>;
  booking(bookingId: string): Promise<{ clientId: string; salonId: string; salonName: string }>;
  review(reviewId: string): Promise<{ clientId: string; salonId: string; salonName: string; hasPhoto: boolean }>;
}

/** Messages à la cliente sur l'expiration de ses points (FID-07) */
export interface ExpiryNotices {
  expiring(userId: string, balance: number, expiresAt: Date): Promise<void>;
  expired(userId: string, points: number): Promise<void>;
}
