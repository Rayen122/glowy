/** Module Dashboard salon (P2) — API publique */
export { recentSalonReviews, salonDay, salonKpis, staffSalon } from "./infrastructure/queries";
export { blockSlot, setupSalon, unblockSlot } from "./infrastructure/actions";
export { blockSlotInput, salonSettingsInput, serviceInput, type BlockSlotInput, type SalonSettingsInput, type ServiceInput } from "./application/schemas";
export { salonSettings, updateSalonSettings, type SalonSettings } from "./infrastructure/settings";
export { createService, deleteService, listSalonServices, updateService, type ManagedService } from "./infrastructure/services";
