/** Module Dashboard salon (P2) — API publique */
export { recentSalonReviews, salonDay, salonKpis, staffSalon } from "./infrastructure/queries";
export { blockSlot, setupSalon, unblockSlot } from "./infrastructure/actions";
export { blockSlotInput, type BlockSlotInput } from "./application/schemas";
