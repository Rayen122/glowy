/**
 * Paie & pointage — règles pures, testées.
 * Journée : temps prévu (horaires du professionnel, sinon ceux du salon), temps pointé (arrivée / départ, pauses possibles),
 * congé (payé, ni retenue ni heures sup) ou absence non justifiée (retenue d'une journée).
 * Salaire brut = fixe mensuel − absences non justifiées + heures sup majorées + commission sur les prestations terminées + prime.
 * Retenues INDICATIVES (Tunisie, à valider par le comptable) : CNSS salarié, IRPP au barème annuel après frais professionnels, CSS.
 * Montants en dinars, arrondis au millime.
 */

export type DayKind = "worked" | "leave" | "absent" | "rest" | "upcoming";
export type DayInput = {
  date: string;
  /** Minutes prévues ce jour-là (0 = jour de repos ou salon fermé) */
  plannedMinutes: number;
  /** Minutes pointées ; null = aucun pointage ce jour-là */
  workedMinutes: number | null;
  /** Congé enregistré (ou absence justifiée par le gérant) */
  leave: boolean;
  /** Absence non justifiée marquée par le gérant (même si un pointage existe) */
  markedAbsent?: boolean;
};
export type DayResult = { date: string; kind: DayKind; plannedMinutes: number; workedMinutes: number; overtimeMinutes: number };

/** Tolérance : un dépassement de 15 minutes au plus dans la journée ne compte pas en heures supplémentaires */
export const OVERTIME_TOLERANCE_MINUTES = 15;

/** Statut d'une journée ; aujourd'hui et les jours à venir ne comptent pas encore comme absences (fiche du mois en cours) */
export function classifyDay(day: DayInput, today: string): DayResult {
  const worked = day.workedMinutes ?? 0;
  const base = { date: day.date, plannedMinutes: day.plannedMinutes, workedMinutes: worked, overtimeMinutes: 0 };
  if (day.leave) return { ...base, kind: "leave", workedMinutes: 0 };
  if (day.markedAbsent) return { ...base, kind: "absent", workedMinutes: 0 };
  if (day.workedMinutes !== null && worked > 0) {
    const beyond = worked - day.plannedMinutes;
    return { ...base, kind: "worked", overtimeMinutes: beyond > OVERTIME_TOLERANCE_MINUTES ? beyond : 0 };
  }
  // Aujourd'hui sans pointage : la journée n'est pas finie, ce n'est pas (encore) une absence
  if (day.date >= today) return { ...base, kind: day.plannedMinutes > 0 ? "upcoming" : "rest" };
  return { ...base, kind: day.plannedMinutes > 0 ? "absent" : "rest" };
}

export type MonthSummary = {
  scheduledDays: number;
  workedDays: number;
  leaveDays: number;
  absentDays: number;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
};

export function summarizeMonth(days: DayResult[]): MonthSummary {
  const count = (kind: DayKind) => days.filter((d) => d.kind === kind).length;
  return {
    scheduledDays: days.filter((d) => d.plannedMinutes > 0).length,
    workedDays: count("worked"),
    leaveDays: count("leave"),
    absentDays: count("absent"),
    plannedMinutes: days.reduce((a, d) => a + d.plannedMinutes, 0),
    workedMinutes: days.reduce((a, d) => a + d.workedMinutes, 0),
    overtimeMinutes: days.reduce((a, d) => a + d.overtimeMinutes, 0),
  };
}

export type PayrollRates = { cnssRate: number; cssRate: number; irpp: boolean };
export const DEFAULT_PAYROLL_RATES: PayrollRates = { cnssRate: 9.18, cssRate: 0.5, irpp: true };

/** Barème annuel de l'IRPP (loi de finances 2025) : [plafond de la tranche en DT, taux en %] — indicatif */
export const IRPP_BRACKETS: readonly [number, number][] = [
  [5_000, 0],
  [10_000, 15],
  [20_000, 25],
  [30_000, 30],
  [40_000, 33],
  [50_000, 36],
  [Infinity, 35],
];
/** Frais professionnels : 10 % du revenu net, plafonnés à 2 000 DT par an */
const PROFESSIONAL_EXPENSES = { rate: 0.1, cap: 2_000 };

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** IRPP annuel d'un revenu imposable annuel, tranche par tranche */
export function annualIncomeTax(taxable: number) {
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of IRPP_BRACKETS) {
    if (taxable <= floor) break;
    tax += (Math.min(taxable, ceiling) - floor) * (rate / 100);
    floor = ceiling;
  }
  return round3(tax);
}

export type PayslipInput = {
  baseSalary: number;
  /** Majoration des heures supplémentaires, en % */
  overtimeRate: number;
  /** Commission en % du chiffre d'affaires des rendez-vous terminés */
  commissionRate: number;
  /** Chiffre d'affaires des rendez-vous terminés du mois */
  revenue: number;
  summary: MonthSummary;
  bonus: number;
  advance: number;
  rates: PayrollRates;
};

export type PayslipLines = {
  hourlyRate: number;
  dailyRate: number;
  absenceDeduction: number;
  overtimePay: number;
  commission: number;
  bonus: number;
  gross: number;
  cnss: number;
  taxableMonthly: number;
  irpp: number;
  css: number;
  advance: number;
  net: number;
};

/** Fiche de paie du mois : du salaire de base au net à payer ; chaque ligne est arrondie au millime et le total tombe juste */
export function computePayslip(input: PayslipInput): PayslipLines {
  const { summary, rates } = input;
  const base = round3(Math.max(0, input.baseSalary));
  const plannedHours = summary.plannedMinutes / 60;
  const hourlyRate = plannedHours > 0 ? base / plannedHours : 0;
  const dailyRate = summary.scheduledDays > 0 ? base / summary.scheduledDays : 0;
  const absenceDeduction = round3(Math.min(base, dailyRate * summary.absentDays));
  const overtimePay = round3(hourlyRate * (summary.overtimeMinutes / 60) * (1 + Math.max(0, input.overtimeRate) / 100));
  const commission = round3(Math.max(0, input.revenue) * (Math.max(0, input.commissionRate) / 100));
  const bonus = round3(Math.max(0, input.bonus));
  const gross = round3(base - absenceDeduction + overtimePay + commission + bonus);
  const cnss = round3(gross * (Math.max(0, rates.cnssRate) / 100));
  // IRPP : revenu net annualisé, moins les frais professionnels (10 %, 2 000 DT par an au plus), au barème, ramené au mois
  const annualNet = (gross - cnss) * 12;
  const annualTaxable = Math.max(0, annualNet - Math.min(annualNet * PROFESSIONAL_EXPENSES.rate, PROFESSIONAL_EXPENSES.cap));
  const irpp = rates.irpp ? round3(annualIncomeTax(annualTaxable) / 12) : 0;
  const css = rates.irpp ? round3((annualTaxable * (Math.max(0, rates.cssRate) / 100)) / 12) : 0;
  const advance = round3(Math.max(0, input.advance));
  return {
    hourlyRate: round3(hourlyRate),
    dailyRate: round3(dailyRate),
    absenceDeduction,
    overtimePay,
    commission,
    bonus,
    gross,
    cnss,
    taxableMonthly: round3(annualTaxable / 12),
    irpp,
    css,
    advance,
    net: round3(gross - cnss - irpp - css - advance),
  };
}

/** Minutes pointées : somme des périodes arrivée → départ (une période encore ouverte compte jusqu'à `now`) */
export function workedMinutes(segments: { in: Date; out: Date | null }[], now: Date) {
  return Math.round(segments.reduce((total, s) => total + Math.max(0, ((s.out ?? now).getTime() - s.in.getTime()) / 60_000), 0));
}

/** « 2026-11 » : mois précédent et nombre de jours */
export const previousPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const daysInPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
};
