import { z } from "zod";
import { CATEGORIES, LOCALES } from "@/core/domain/enums";

const RATE = z.coerce.number().min(0, "Entre 0 et 30 %").max(30, "Entre 0 et 30 %");

/** ADM-05 / ADM-06 : chaque section est facultative (enregistrement section par section) */
export const platformSettingsInput = z
  .object({
    cities: z
      .array(z.object({ name: z.string().trim().min(2, "2 caractères minimum").max(40), active: z.boolean() }))
      .min(1)
      .max(60)
      .refine((list) => new Set(list.map((c) => c.name.toLowerCase())).size === list.length, "Ville en double"),
    categories: z.array(z.object({ id: z.enum(CATEGORIES), active: z.boolean() })).length(CATEGORIES.length),
    serviceGroups: z
      .array(z.string().trim().min(2).max(40))
      .min(1)
      .max(40)
      .refine((list) => new Set(list.map((g) => g.toLowerCase())).size === list.length, "Catégorie en double"),
    locales: z
      .array(z.enum(LOCALES))
      .min(1)
      .refine((list) => list.includes("fr"), "Le français reste toujours disponible"),
    commissions: z.object({ gratuit: RATE, pro: RATE, premium: RATE }),
  })
  .partial();
export type PlatformSettingsInput = z.infer<typeof platformSettingsInput>;

/** ADM-10 : annonce envoyée à tous, aux clientes ou aux salons */
export const announcementInput = z.object({
  title: z.string().trim().min(3, "3 caractères minimum").max(80),
  body: z.string().trim().min(10, "10 caractères minimum").max(500),
  audience: z.enum(["ALL", "CLIENTS", "SALONS"]),
  link: z
    .string()
    .trim()
    .regex(/^\/[\w\-/?=&%.]*$/, "Lien interne attendu (ex. /salons)")
    .max(200)
    .nullable()
    .default(null),
});
export type AnnouncementInput = z.infer<typeof announcementInput>;
