import { z } from "zod";

/** Entrées validées des cas d'usage « comptes » (formulaires d'inscription et de connexion) */

const PASSWORD = z.string().min(8, "8 caractères minimum").max(128);
const EMAIL = z.email("Adresse e-mail invalide").trim().toLowerCase();
const LOCALE = z.enum(["fr", "ar", "en"]).default("fr");

export const registerInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("client"),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: EMAIL,
    password: PASSWORD,
    referralCode: z.string().trim().max(32).optional(),
    locale: LOCALE,
  }),
  z.object({
    type: z.literal("salon"),
    salonName: z.string().trim().min(2).max(80),
    category: z.enum(["coiffure", "barbier", "ongles", "spa", "maquillage", "visage"]),
    city: z.string().trim().min(2).max(60),
    address: z.string().trim().min(4).max(160),
    email: EMAIL,
    phone: z.string().trim().regex(/^[+\d\s]{8,20}$/, "Numéro invalide"),
    password: PASSWORD,
    plan: z.enum(["gratuit", "pro", "premium"]).default("gratuit"),
    documentName: z.string().trim().max(200).optional(),
    locale: LOCALE,
  }),
]);

export type RegisterInput = z.infer<typeof registerInput>;

export const credentialsInput = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) });

/** AUTH-05 : demande de lien de réinitialisation */
export const forgotPasswordInput = z.object({ email: z.email("Adresse e-mail invalide").trim().toLowerCase() });
/** AUTH-05 : nouveau mot de passe à partir du lien reçu */
export const resetPasswordInput = z.object({ token: z.string().min(20).max(200), password: PASSWORD });
/** AUTH-06 : lien de vérification de l'adresse e-mail */
export const verifyEmailInput = z.object({ token: z.string().min(20).max(200) });
/** Changement de mot de passe d'un utilisateur connecté (ex. employé avec un mot de passe temporaire) */
export const changePasswordInput = z
  .object({ current: z.string().min(1).max(128), next: PASSWORD })
  .refine((v) => v.current !== v.next, { message: "Le nouveau mot de passe doit être différent", path: ["next"] });
