import { notFound } from "@/core/domain/errors";
import { Employee, idOf, objectId, Salon, User } from "@/infrastructure/db";

/** CLI-03 : ajout / retrait d'un salon favori */
export async function setFavorite(userId: string, salonSlug: string, favorite: boolean) {
  const salon = await Salon.findOne({ slug: salonSlug }, { _id: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  await User.updateOne({ _id: objectId(userId) }, favorite ? { $addToSet: { favorites: salon._id } } : { $pull: { favorites: salon._id } });
  return { salonSlug, favorite };
}

/** CLI-03 : ajout / retrait d'un professionnel favori (identifié par le salon et sa clé) */
export async function setFavoriteEmployee(userId: string, salonSlug: string, employeeKey: string, favorite: boolean) {
  const salon = await Salon.findOne({ slug: salonSlug }, { _id: 1 }).lean();
  const employee = salon ? await Employee.findOne({ salon: salon._id, key: employeeKey }, { _id: 1 }).lean() : null;
  if (!employee) throw notFound("Professionnel introuvable.");
  await User.updateOne({ _id: objectId(userId) }, favorite ? { $addToSet: { favoriteEmployees: employee._id } } : { $pull: { favoriteEmployees: employee._id } });
  return { salonSlug, employeeKey, favorite };
}

/** Professionnels favoris de la cliente, avec leur salon (réservation directe avec eux) */
export async function favoriteEmployees(userId: string) {
  const user = await User.findById(objectId(userId), { favoriteEmployees: 1 }).lean();
  const employees = await Employee.find({ _id: { $in: user?.favoriteEmployees ?? [] } }).lean();
  const salons = await Salon.find({ _id: { $in: employees.map((e) => e.salon) }, status: "ACTIVE" }, { slug: 1, name: 1, city: 1 }).lean();
  return employees.flatMap((e) => {
    const salon = salons.find((s) => s._id.equals(e.salon));
    if (!salon) return [];
    return [{ id: idOf(e), key: e.key, name: e.name, title: e.title ?? "", rating: e.rating ?? 0, avatar: e.avatarUrl ?? null, active: e.active, salon: { slug: salon.slug, name: salon.name, city: salon.city } }];
  });
}

export type FavoriteEmployee = Awaited<ReturnType<typeof favoriteEmployees>>[number];
