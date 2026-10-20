/**
 * Module Affluence (P2) — API publique : prévision d'affluence par heure (IA P2, repli sur une courbe type),
 * affluence en direct et file d'attente virtuelle (RES-08).
 */
import type { Actor } from "@/core/domain/actor";
import { notify } from "@/modules/notifications";
import type { QueueAction } from "./application/schemas";
import { queueAction as applyQueueAction } from "./infrastructure/queue";

export const queueAction = (actor: Actor, salonId: string, entryId: string, action: QueueAction) => applyQueueAction(actor, salonId, entryId, action, notify);

export { liveAffluence, salonForecast, type SalonForecast } from "./infrastructure/mongo-affluence";
export { addWalkIn, joinQueue, leaveQueue, myQueueStatus, salonOpenNow, salonQueue, type SalonQueue } from "./infrastructure/queue";
export { joinQueueInput, queueActionInput, walkInInput, type QueueAction } from "./application/schemas";
export { bestWindow, forecastDay, levelFor, liveStatus, offPeakHours, waitFor, type Affluence, type ForecastPoint } from "./domain/forecast";
