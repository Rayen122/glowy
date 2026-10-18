import { notFound } from "@/core/domain/errors";
import { objectId, Salon, User } from "@/infrastructure/db";

/** CLI-03 : ajout / retrait d'un salon favori */
export async function setFavorite(userId: string, salonSlug: string, favorite: boolean) {
  const salon = await Salon.findOne({ slug: salonSlug }, { _id: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  await User.updateOne({ _id: objectId(userId) }, favorite ? { $addToSet: { favorites: salon._id } } : { $pull: { favorites: salon._id } });
  return { salonSlug, favorite };
}
