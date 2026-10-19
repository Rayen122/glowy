/** Module Dashboard salon (P2) — API publique */
export { recentSalonReviews, salonDay, salonKpis, staffSalon } from "./infrastructure/queries";
export { blockSlot, setupSalon, unblockSlot } from "./infrastructure/actions";
export {
  blockSlotInput,
  employeeAccountInput,
  employeeInput,
  leaveInput,
  salonSettingsInput,
  serviceInput,
  type BlockSlotInput,
  type EmployeeInput,
  type LeaveInput,
  type SalonSettingsInput,
  type ServiceInput,
} from "./application/schemas";
export { addLeave, createEmployee, createEmployeeAccount, deleteEmployee, listTeam, revokeEmployeeAccount, updateEmployee, type TeamMember } from "./infrastructure/team";
export { salonSettings, updateSalonSettings, type SalonSettings } from "./infrastructure/settings";
export { createService, deleteService, listSalonServices, updateService, type ManagedService } from "./infrastructure/services";
export { salonBookingsCsv, salonStats, STAT_PERIODS, type SalonStats, type StatPeriod } from "./infrastructure/stats";
