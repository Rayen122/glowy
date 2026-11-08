import { z } from "zod";

const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure au format HH:MM");
const PERIOD = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois au format AAAA-MM");
const MONEY = z.coerce.number().min(0, "Montant positif").max(100_000, "Montant trop élevé");

/** Arrivée ou départ du professionnel connecté */
export const clockInput = z.object({ action: z.enum(["in", "out"]) });

/** Correction d'une journée par le gérant : présent (avec ses heures), absence non justifiée ou justifiée */
export const attendanceInput = z
  .object({
    employeeId: z.string().regex(/^[a-f\d]{24}$/i),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["PRESENT", "ABSENT", "EXCUSED"]),
    segments: z.array(z.object({ in: TIME, out: TIME.nullable() })).max(4).default([]),
    note: z.string().trim().max(200).default(""),
  })
  .refine((d) => d.status !== "PRESENT" || d.segments.length > 0, { message: "Indiquez au moins une arrivée", path: ["segments"] })
  .refine((d) => d.segments.every((s) => !s.out || s.out > s.in), { message: "Le départ doit être après l'arrivée", path: ["segments"] });

/** Brouillons des fiches de paie d'un mois */
export const generateInput = z.object({ period: PERIOD });

/** Brouillon : prime et avance sur salaire, puis recalcul ou validation */
export const payslipUpdateInput = z.object({
  bonus: MONEY.optional(),
  advance: MONEY.optional(),
  note: z.string().trim().max(300).optional(),
  action: z.enum(["save", "recompute", "validate"]).default("save"),
});

/** Taux des retenues indicatives du salon */
export const payrollSettingsInput = z.object({
  cnssRate: z.coerce.number().min(0).max(30),
  cssRate: z.coerce.number().min(0).max(5),
  irpp: z.boolean(),
});

export type AttendanceInput = z.infer<typeof attendanceInput>;
export type PayslipUpdateInput = z.infer<typeof payslipUpdateInput>;
export type PayrollSettingsInput = z.infer<typeof payrollSettingsInput>;
