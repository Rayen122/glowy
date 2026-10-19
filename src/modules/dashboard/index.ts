/** Module Dashboard salon (P2) — API publique */
export { recentSalonReviews, salonDay, salonKpis, salonRange, staffSalon } from "./infrastructure/queries";
export { blockSlot, setupSalon, unblockSlot } from "./infrastructure/actions";
export {
  blockSlotInput,
  clientNoteInput,
  employeeAccountInput,
  employeeInput,
  leaveInput,
  salonSettingsInput,
  serviceInput,
  type BlockSlotInput,
  type ClientNoteInput,
  type EmployeeInput,
  type LeaveInput,
  type SalonSettingsInput,
  type ServiceInput,
} from "./application/schemas";
export { addLeave, createEmployee, createEmployeeAccount, deleteEmployee, listTeam, revokeEmployeeAccount, updateEmployee, type TeamMember } from "./infrastructure/team";
export { salonSettings, updateSalonSettings, type SalonSettings } from "./infrastructure/settings";
export { createService, deleteService, listSalonServices, updateService, type ManagedService } from "./infrastructure/services";
export { salonBookingsCsv, salonStats, STAT_PERIODS, type SalonStats, type StatPeriod } from "./infrastructure/stats";
export { ADMIN_SALON_COOKIE, currentSalonId } from "./infrastructure/current-salon";
export { addClientNote, CRM_FILTERS, deleteClientNote, listSalonClients, salonClientCard, type CrmFilter, type SalonClientCard, type SalonClientRow } from "./infrastructure/crm";
