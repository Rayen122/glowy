import { z } from "zod";

/** API indépendante de l'IA P4 : analyse d'un texte d'avis (démonstration, intégration externe) */
export const analyzeReviewInput = z.object({ text: z.string().trim().min(2).max(1000), rating: z.coerce.number().int().min(1).max(5) });
