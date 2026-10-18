import { z } from "zod";
import { notFound } from "@/core/domain/errors";
import { objectId, User, type UserDoc } from "@/infrastructure/db";
import { alreadyAwarded, award } from "@/modules/loyalty";

export const profileInput = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().regex(/^[+\d\s]{8,20}$/, "Numéro invalide").optional(),
  city: z.string().trim().max(60).optional(),
  birthDate: z.iso.date().optional(),
  locale: z.enum(["fr", "ar", "en"]).optional(),
});

export async function getProfile(userId: string) {
  const _id = objectId(userId);
  const user = _id ? await User.findById(_id).lean<UserDoc>() : null;
  if (!user) throw notFound("Utilisateur introuvable.");
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    city: user.city ?? null,
    birthDate: user.birthDate ?? null,
    locale: user.locale,
    role: user.role,
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt,
  };
}

/** CLI-01 ; profil complet (téléphone, ville, date de naissance) = +20 pts une seule fois */
export async function updateProfile(userId: string, input: z.infer<typeof profileInput>) {
  const { birthDate, ...rest } = input;
  const user = await User.findByIdAndUpdate(objectId(userId), { $set: { ...rest, ...(birthDate ? { birthDate: new Date(birthDate) } : {}) } }, { returnDocument: "after" }).lean<UserDoc>();
  if (!user) throw notFound("Utilisateur introuvable.");
  if (user.phone && user.city && user.birthDate && !(await alreadyAwarded(userId, "PROFILE_COMPLETED", {}))) await award(userId, "PROFILE_COMPLETED");
  return getProfile(userId);
}
