import type { Actor } from "@/core/domain/actor";
import type { Category, SalonStatus } from "@/core/domain/enums";
import { conflict, forbidden } from "@/core/domain/errors";

/** Super Admin (P1, section 3.6) — règles pures */

export const assertAdmin = (actor: Actor) => {
  if (actor.role !== "ADMIN") throw forbidden();
};

/** ADM-02, ADM-03, AVI-03 : valider (badge « Salon vérifié »), refuser, suspendre, réactiver */
export const SALON_TRANSITIONS = {
  approve: { from: ["PENDING"], to: "ACTIVE", verified: true },
  reject: { from: ["PENDING"], to: "REJECTED", verified: false },
  suspend: { from: ["ACTIVE"], to: "SUSPENDED", verified: undefined },
  reactivate: { from: ["SUSPENDED"], to: "ACTIVE", verified: undefined },
} as const satisfies Record<string, { from: readonly SalonStatus[]; to: SalonStatus; verified: boolean | undefined }>;

export type SalonAction = keyof typeof SALON_TRANSITIONS;

export function salonTransition(action: SalonAction, current: SalonStatus) {
  const transition = SALON_TRANSITIONS[action];
  if (!(transition.from as readonly SalonStatus[]).includes(current)) throw conflict("INVALID_TRANSITION", "Action impossible dans l'état actuel du salon.");
  return transition;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  coiffure: "Coiffure",
  barbier: "Barbier",
  ongles: "Ongles",
  spa: "Spa",
  maquillage: "Maquillage",
  visage: "Soins du visage",
};

export type FlaggedReviewRow = {
  id: string;
  salon: string;
  author: string;
  rating: number;
  text: string;
  lang: string;
  score: number;
  reasons: string[];
  reportedBy: "ai" | "salon";
};

/** Regroupe les signalements par avis (un avis peut être signalé plusieurs fois), du plus suspect au moins suspect */
export function groupFlagged(reports: { source: string; reason: string; review: Omit<FlaggedReviewRow, "reasons" | "reportedBy"> }[]) {
  const rows = new Map<string, FlaggedReviewRow>();
  for (const report of reports) {
    const row = rows.get(report.review.id) ?? { ...report.review, reasons: [], reportedBy: report.source === "AI" ? "ai" : "salon" };
    row.reasons.push(...report.reason.split(" · "));
    rows.set(report.review.id, row);
  }
  return [...rows.values()].sort((a, b) => b.score - a.score);
}
