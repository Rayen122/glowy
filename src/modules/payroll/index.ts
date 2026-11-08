/** Module Paie & pointage — API publique : pointage des professionnels, dossier mensuel, fiches de paie */
export { clock, correctAttendance, employeeMonth, employeeOfUser, managedEmployee, myToday, salonToday, type EmployeeMonth, type SalonTodayRow } from "./infrastructure/attendance";
export { ensureMonthlyPayslips, generateForActor, generatePayslips, myPayslips, payrollRates, payslipFor, salonPayslips, updatePayrollRates, updatePayslip, type PayslipView } from "./infrastructure/payslips";
export { attendanceInput, clockInput, generateInput, payrollSettingsInput, payslipUpdateInput } from "./application/schemas";
export { annualIncomeTax, computePayslip, DEFAULT_PAYROLL_RATES, IRPP_BRACKETS, previousPeriod, type MonthSummary, type PayrollRates, type PayslipLines } from "./domain/payroll";
