/**
 * Module Administration (P1) — API publique.
 * Câblage : cas d'usage ← dépôt MongoDB, bus d'événements.
 */
import { eventBus } from "@/infrastructure/event-bus";
import { makeAdmin } from "./application/use-cases";
import { mongoAdminRepository } from "./infrastructure/mongo-admin-repository";

export const { setSalonStatus, setUserStatus } = makeAdmin({ admin: mongoAdminRepository, events: eventBus });

export { salonActionInput, userActionInput } from "./application/schemas";
export { adminOverview, adminQueues, type PendingSalonRow } from "./infrastructure/queries";
export type { FlaggedReviewRow } from "./domain/policy";
export { auditTrail, bookingsByCity, listSalonsForAdmin, listUsersForAdmin, moderationHistory, PAGE_SIZE, platformGrowth, salonExists, sendPasswordResetFor, type AdminSalonRow, type AdminUserRow } from "./infrastructure/manage";
