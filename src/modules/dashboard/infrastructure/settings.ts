import type { Actor } from "@/core/domain/actor";
import { objectId, Salon } from "@/infrastructure/db";
import { staffSalonId } from "@/modules/identity";
import type { SalonSettingsInput } from "../application/schemas";

/** SAL-02 / SAL-07 : profil public et règles de réservation du salon */

export async function salonSettings(salonId: string) {
  const s = await Salon.findById(objectId(salonId)).orFail().lean();
  return {
    id: s._id.toString(),
    slug: s.slug,
    name: s.name,
    description: s.description ?? null,
    phone: s.phone ?? null,
    address: s.address,
    city: s.city,
    coverUrl: s.coverUrl ?? null,
    photos: s.photos.map((p) => ({ url: p.url ?? "", kind: (p.kind ?? "GALLERY") as "GALLERY" | "BEFORE" | "AFTER" })).filter((p) => p.url),
    amenities: s.amenities,
    openingHours: [...s.openingHours]
      .filter((h) => h.opensAt && h.closesAt)
      .map((h) => ({ weekday: h.weekday ?? 0, opensAt: h.opensAt!, closesAt: h.closesAt! }))
      .sort((a, b) => a.weekday - b.weekday),
    cancellationHours: s.cancellationHours,
    depositAmount: s.depositAmount,
    status: s.status,
  };
}

export type SalonSettings = Awaited<ReturnType<typeof salonSettings>>;

/** Mise à jour d'une section (le gérant ou le Super Admin) ; le slug (adresse de la page) ne change pas */
export async function updateSalonSettings(actor: Actor, input: SalonSettingsInput) {
  const _id = objectId(await staffSalonId(actor))!;
  const set: Record<string, unknown> = { ...input };
  if (input.photos) set.photos = input.photos.map((p, position) => ({ ...p, position }));
  await Salon.updateOne({ _id }, { $set: set });
  return salonSettings(_id.toString());
}
