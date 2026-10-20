import { z } from "zod";

export const chatInput = z.object({ message: z.string().trim().min(1).max(500), salonSlug: z.string().max(120).optional() });
