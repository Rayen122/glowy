import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import { slugify } from "@/core/domain/text";
import { tunisToUtc } from "@/core/domain/time";
import { Employee, objectId, Salon, TimeOff } from "@/infrastructure/db";
import { createTimeOff, deleteTimeOff } from "@/modules/booking";
import { staffSalonId } from "@/modules/identity";
import type { BlockSlotInput } from "../application/schemas";

/** Horaires par défaut d'un salon qui démarre : du lundi au samedi, 9 h – 19 h (modifiables dans les paramètres) */
const DEFAULT_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "09:00", closesAt: "19:00" }));

/**
 * Mise en route d'un salon neuf (SAL-05, SAL-07) : sans horaires ni professionnel, l'agenda et la réservation
 * restent vides. Ajoute les horaires par défaut et le gérant comme premier professionnel — sans jamais écraser l'existant.
 */
export async function setupSalon(actor: Actor, ownerName: string) {
  const salonId = objectId(await staffSalonId(actor))!;
  const hoursCreated = (await Salon.updateOne({ _id: salonId, "openingHours.0": { $exists: false } }, { $set: { openingHours: DEFAULT_HOURS } })).modifiedCount > 0;
  let employeeCreated = false;
  if (!(await Employee.exists({ salon: salonId }))) {
    await Employee.create({ salon: salonId, key: slugify(ownerName) || "gerant", name: ownerName || "Gérant", title: "Gérant", color: 1 });
    employeeCreated = true;
  }
  return { hoursCreated, employeeCreated };
}

/** SAL-04 : bloque un créneau (pause, congé) ; refusé si un rendez-vous ou un autre blocage l'occupe déjà */
export async function blockSlot(actor: Actor, input: BlockSlotInput) {
  const salon = objectId(await staffSalonId(actor))!;
  const employee = objectId(input.employeeId);
  if (!employee || !(await Employee.exists({ _id: employee, salon }))) throw notFound("Professionnel introuvable.");
  const id = await createTimeOff(input.employeeId, tunisToUtc(input.date, input.from), tunisToUtc(input.date, input.to), input.label);
  if (!id) throw conflict("SLOT_TAKEN", "Un rendez-vous ou un blocage occupe déjà ce créneau.");
  return { id };
}

/** Retire un blocage de l'agenda (uniquement ceux d'un employé du salon) */
export async function unblockSlot(actor: Actor, timeOffId: string) {
  const salon = objectId(await staffSalonId(actor))!;
  const id = objectId(timeOffId);
  const block = id ? await TimeOff.findById(id, { employee: 1 }).lean() : null;
  if (!block || !(await Employee.exists({ _id: block.employee, salon }))) throw notFound("Blocage introuvable.");
  await deleteTimeOff(timeOffId);
  return { id: timeOffId };
}
