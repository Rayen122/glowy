import { z } from "zod";
import { isIsoDate } from "./domain/time";

/** Formats communs des API : date réelle AAAA-MM-JJ (« 2026-13-45 » → 400, jamais 500) et heure HH:MM */
export const DATE = z.string().refine(isIsoDate, "Date attendue au format AAAA-MM-JJ (date réelle)");
export const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");
