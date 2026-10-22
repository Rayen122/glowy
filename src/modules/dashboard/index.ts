/** Module Dashboard salon (P2) — API publique */
import type { Actor } from "@/core/domain/actor";
import { notify } from "@/modules/notifications";
import type { StockMoveInput } from "./application/schemas";
import { moveStock as applyStockMove } from "./infrastructure/stocks";
import { eventBus } from "@/infrastructure/event-bus";
import type { BranchInput } from "./application/schemas";
import { createBranch as applyCreateBranch } from "./infrastructure/branches";

export { recentSalonReviews, salonDay, salonKpis, salonRange, staffSalon } from "./infrastructure/queries";
export { blockSlot, setupSalon, unblockSlot } from "./infrastructure/actions";
export {
  blockSlotInput,
  branchInput,
  branchSwitchInput,
  checkoutInput,
  productInput,
  stockMoveInput,
  clientNoteInput,
  employeeAccountInput,
  employeeInput,
  leaveInput,
  salonSettingsInput,
  serviceInput,
  voidInvoiceInput,
  type BlockSlotInput,
  type BranchInput,
  type CheckoutInput,
  type ProductInput,
  type StockMoveInput,
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
export { ADMIN_SALON_COOKIE, BRANCH_COOKIE, currentSalonId } from "./infrastructure/current-salon";
export { addClientNote, CRM_FILTERS, deleteClientNote, listSalonClients, salonClientCard, type CrmFilter, type SalonClientCard, type SalonClientRow } from "./infrastructure/crm";
export { cashierDay, checkout, invoiceDetail, voidInvoice, type CashierDay, type InvoiceDetail } from "./infrastructure/cashier";
export { invoiceNumber, invoicePrefix, invoiceTotals } from "./domain/invoice";
export { createProduct, deleteProduct, listProducts, lowStockCount, updateProduct, type StockOverview } from "./infrastructure/stocks";
export const moveStock = (actor: Actor, salonId: string, productId: string, input: StockMoveInput) => applyStockMove(actor, salonId, productId, input, notify);
export { assertOwnBranch, listBranches, type Branch } from "./infrastructure/branches";
export const createBranch = (actor: Actor, input: BranchInput) => applyCreateBranch(actor, input, eventBus);
