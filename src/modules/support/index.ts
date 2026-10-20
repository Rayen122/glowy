/** Module Support (AVI-07, bonus) — API publique */
import type { Actor } from "@/core/domain/actor";
import { notify } from "@/modules/notifications";
import type { TicketInput } from "./application/schemas";
import { openTicket as open, replyToTicket as reply } from "./infrastructure/tickets";

export const openTicket = (actor: Actor, salonId: string | null, input: TicketInput) => open(actor, salonId, input, notify);
export const replyToTicket = (actor: Actor, id: string, text: string) => reply(actor, id, text, notify);
export { myTickets, openTicketsCount, setTicketStatus, supportQueue, ticketThread, type SupportQueueRow, type TicketThread } from "./infrastructure/tickets";
export { SUPPORT_CATEGORIES, ticketInput, ticketMessageInput, ticketStatusInput, type TicketInput } from "./application/schemas";
