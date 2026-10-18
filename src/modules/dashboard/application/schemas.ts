import { z } from "zod";

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");

/** Blocage d'un créneau dans l'agenda (SAL-04) : pause, congé, indisponibilité */
export const blockSlotInput = z
  .object({
    employeeId: z.string().min(1),
    date: DATE,
    from: TIME,
    to: TIME,
    label: z.string().trim().min(1, "Indiquez un libellé").max(60),
  })
  .refine((v) => v.to > v.from, { message: "L'heure de fin doit être après l'heure de début", path: ["to"] });

export type BlockSlotInput = z.infer<typeof blockSlotInput>;
