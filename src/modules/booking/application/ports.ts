import type { Actor } from "@/core/domain/actor";
import type { BookingStatus, PaymentMethod } from "@/core/domain/enums";
import type { DaySchedule } from "../domain/availability";

export type ServiceRef = { key: string; name: string; price: number; durationMin: number };

/** Réservation telle que renvoyée par les cas d'usage (et les routes API) */
export type BookingRecord = {
  id: string;
  clientId: string;
  salonId: string;
  employeeId: string;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  /** Prix après remise */
  totalPrice: number;
  /** Remise de la promotion appliquée (SAL-10) */
  discount: number;
  promotionId: string | null;
  deposit: number;
  paymentMethod: PaymentMethod;
  offPeak: boolean;
  note: string | null;
  cancelledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export type NewBooking = Omit<BookingRecord, "id" | "status" | "cancelledAt" | "completedAt" | "createdAt" | "promotionId"> & {
  items: ServiceRef[];
  promo: { promotionId: string; code: string | null; label: string } | null;
};

export interface BookingRepository {
  salonBySlug(slug: string): Promise<{ id: string; active: boolean; depositPercent: number } | null>;
  salonPolicy(salonId: string): Promise<{ cancellationHours: number }>;
  activeServices(salonId: string, keys: string[]): Promise<ServiceRef[]>;
  daySchedule(salonId: string, date: string, opts?: { employeeKey?: string; employeeId?: string; ignoreBookingId?: string }): Promise<DaySchedule>;
  /** Verrouille les tranches de l'employé puis enregistre la réservation ; null si une tranche est déjà prise */
  insertIfFree(data: NewBooking): Promise<BookingRecord | null>;
  findById(id: string): Promise<BookingRecord | null>;
  /** Annule (si encore active) et libère les tranches ; rembourse l'acompte si `refund` */
  cancel(id: string, at: Date, refund: boolean): Promise<BookingRecord | null>;
  /** Déplace la réservation (même employé) si les nouvelles tranches sont libres ; null sinon */
  moveIfFree(id: string, startsAt: Date, endsAt: Date, offPeak: boolean): Promise<BookingRecord | null>;
  /** Change le statut si le statut actuel est `from` ; libère les tranches quand la réservation n'est plus active */
  setStatus(id: string, from: BookingStatus, to: BookingStatus, at: Date): Promise<BookingRecord | null>;
}

export interface SalonAccessPort {
  canManageSalon(actor: Actor, salonId: string): Promise<boolean>;
}

/** Promotions du salon (module Promotions, SAL-10) */
export interface PromotionPort {
  quote(salonId: string, ctx: { code?: string | null; subtotal: number; startsAt: Date }): Promise<{ promotionId: string; code: string | null; label: string; discount: number } | null>;
  /** Réserve une utilisation du code ; false si le nombre maximal vient d'être atteint */
  consume(promotionId: string): Promise<boolean>;
  release(promotionId: string): Promise<void>;
}
