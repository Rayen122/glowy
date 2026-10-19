import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import { slugify } from "@/core/domain/text";
import { objectId, Salon } from "@/infrastructure/db";
import { staffSalonId } from "@/modules/identity";
import type { ServiceInput } from "../application/schemas";

/** SAL-03 : prestations du salon (imbriquées dans le document salon) — réservé au gérant et au Super Admin */

const managedSalon = async (actor: Actor) => objectId(await staffSalonId(actor))!;

export type ManagedService = {
  id: string;
  key: string;
  name: string;
  group: string;
  description: string | null;
  durationMin: number;
  price: number;
  oldPrice: number | null;
  popular: boolean;
  active: boolean;
  position: number;
};

export async function listSalonServices(salonId: string): Promise<ManagedService[]> {
  const salon = await Salon.findById(objectId(salonId), { services: 1 }).lean();
  return (salon?.services ?? [])
    .map((s) => ({
      id: s._id.toString(),
      key: s.key,
      name: s.name,
      group: s.group,
      description: s.description ?? null,
      durationMin: s.durationMin,
      price: s.price,
      oldPrice: s.oldPrice ?? null,
      popular: s.popular,
      active: s.active,
      position: s.position,
    }))
    .sort((a, b) => a.position - b.position);
}

/** Clé stable utilisée par la réservation (/reserver?services=cle) ; unique dans le salon */
function uniqueKey(name: string, taken: string[]) {
  const base = slugify(name) || "prestation";
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}-${i}`;
  return key;
}

export async function createService(actor: Actor, input: ServiceInput) {
  const _id = await managedSalon(actor);
  const salon = await Salon.findById(_id, { services: 1 }).orFail().lean();
  if (salon.services.some((s) => s.name.toLowerCase() === input.name.toLowerCase())) throw conflict("SERVICE_EXISTS", "Une prestation porte déjà ce nom.");
  const key = uniqueKey(input.name, salon.services.map((s) => s.key));
  const position = Math.max(-1, ...salon.services.map((s) => s.position)) + 1;
  await Salon.updateOne({ _id }, { $push: { services: { ...input, description: input.description || null, oldPrice: input.oldPrice ?? null, key, position } } });
  return { key };
}

export async function updateService(actor: Actor, serviceId: string, input: ServiceInput) {
  const _id = await managedSalon(actor);
  const sid = objectId(serviceId);
  const salon = await Salon.findById(_id, { services: 1 }).orFail().lean();
  if (!sid || !salon.services.some((s) => s._id.equals(sid))) throw notFound("Prestation introuvable.");
  if (salon.services.some((s) => !s._id.equals(sid) && s.name.toLowerCase() === input.name.toLowerCase())) throw conflict("SERVICE_EXISTS", "Une prestation porte déjà ce nom.");
  const set = Object.fromEntries(
    Object.entries({ ...input, description: input.description || null, oldPrice: input.oldPrice ?? null }).map(([k, v]) => [`services.$.${k}`, v])
  );
  await Salon.updateOne({ _id, "services._id": sid }, { $set: set });
  return { id: serviceId };
}

/** Les rendez-vous gardent une copie du nom et du prix : supprimer une prestation ne les modifie pas */
export async function deleteService(actor: Actor, serviceId: string) {
  const _id = await managedSalon(actor);
  const sid = objectId(serviceId);
  const result = sid ? await Salon.updateOne({ _id }, { $pull: { services: { _id: sid } } }) : null;
  if (!result?.modifiedCount) throw notFound("Prestation introuvable.");
  return { id: serviceId };
}
