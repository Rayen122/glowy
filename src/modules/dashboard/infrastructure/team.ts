import type { Types } from "mongoose";
import type { Actor } from "@/core/domain/actor";
import { conflict, notFound } from "@/core/domain/errors";
import { slugify } from "@/core/domain/text";
import { addDays, tunisToUtc, utcToTunis } from "@/core/domain/time";
import { Booking, Employee, objectId, TimeOff, User } from "@/infrastructure/db";
import { createTimeOff, deleteTimeOff } from "@/modules/booking";
import { createStaffAccount } from "@/modules/identity";
import { sendEmail } from "@/modules/notifications";
import type { EmployeeInput, LeaveInput } from "../application/schemas";
import { currentSalonId } from "./current-salon";

/** SAL-05 / AUTH-07 : équipe du salon — réservé au gérant et au Super Admin */

const ACTIVE = ["PENDING", "CONFIRMED", "IN_PROGRESS"] as ("PENDING" | "CONFIRMED" | "IN_PROGRESS")[];
const managedSalon = async (actor: Actor) => objectId(await currentSalonId(actor))!;

async function ownEmployee(actor: Actor, employeeId: string) {
  const salon = await managedSalon(actor);
  const _id = objectId(employeeId);
  const employee = _id ? await Employee.findOne({ _id, salon }).lean() : null;
  if (!employee) throw notFound("Professionnel introuvable.");
  return employee;
}

export async function listTeam(salonId: string, now = new Date()) {
  const salon = objectId(salonId);
  const employees = await Employee.find({ salon }).sort({ active: -1, createdAt: 1 }).lean();
  const ids = employees.map((e) => e._id);
  const [users, upcoming, leaves] = await Promise.all([
    User.find({ _id: { $in: employees.map((e) => e.user).filter(Boolean) } }, { email: 1, status: 1 }).lean(),
    Booking.aggregate<{ _id: unknown; count: number }>([{ $match: { employee: { $in: ids }, status: { $in: ACTIVE }, startsAt: { $gte: now } } }, { $group: { _id: "$employee", count: { $sum: 1 } } }]),
    TimeOff.find({ employee: { $in: ids }, endsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(200).lean(),
  ]);
  const userById = new Map(users.map((u) => [u._id.toString(), u]));
  const upcomingBy = new Map(upcoming.map((u) => [String(u._id), u.count]));
  return employees.map((e) => {
    const account = e.user ? userById.get(e.user.toString()) : null;
    return {
      id: e._id.toString(),
      key: e.key,
      name: e.name,
      title: e.title,
      color: e.color,
      avatarUrl: e.avatarUrl ?? null,
      active: e.active,
      rating: e.rating,
      workingHours: e.workingHours.filter((w) => w.startsAt && w.endsAt).map((w) => ({ weekday: w.weekday ?? 0, startsAt: w.startsAt!, endsAt: w.endsAt!, off: Boolean(w.off) })),
      account: account ? { email: account.email, status: account.status } : null,
      upcomingBookings: upcomingBy.get(e._id.toString()) ?? 0,
      leaves: leaves
        .filter((l) => l.employee.equals(e._id))
        .map((l) => ({ id: l._id.toString(), from: utcToTunis(l.startsAt), to: utcToTunis(l.endsAt), label: l.label })),
    };
  });
}

export type TeamMember = Awaited<ReturnType<typeof listTeam>>[number];

async function uniqueKey(salon: Types.ObjectId, name: string) {
  const base = slugify(name) || "pro";
  let key = base;
  for (let i = 2; await Employee.exists({ salon, key }); i++) key = `${base}-${i}`;
  return key;
}

export async function createEmployee(actor: Actor, input: EmployeeInput) {
  const salon = await managedSalon(actor);
  const created = await Employee.create({ ...input, salon, key: await uniqueKey(salon, input.name) });
  return { id: created._id.toString() };
}

export async function updateEmployee(actor: Actor, employeeId: string, input: EmployeeInput) {
  const employee = await ownEmployee(actor, employeeId);
  await Employee.updateOne({ _id: employee._id }, { $set: input });
  return { id: employeeId };
}

/**
 * Suppression : un professionnel qui a déjà des rendez-vous est seulement désactivé (l'historique et les avis
 * restent liés à lui) ; sinon il est supprimé avec ses congés.
 */
export async function deleteEmployee(actor: Actor, employeeId: string) {
  const employee = await ownEmployee(actor, employeeId);
  if (await Booking.exists({ employee: employee._id })) {
    if (await Booking.exists({ employee: employee._id, status: { $in: ACTIVE }, startsAt: { $gte: new Date() } })) {
      throw conflict("HAS_BOOKINGS", "Ce professionnel a encore des rendez-vous à venir : déplacez-les ou annulez-les d'abord.");
    }
    await Employee.updateOne({ _id: employee._id }, { $set: { active: false } });
    return { id: employeeId, deactivated: true };
  }
  for (const leave of await TimeOff.find({ employee: employee._id }, { _id: 1 }).lean()) await deleteTimeOff(leave._id.toString());
  if (employee.user) await User.updateOne({ _id: employee.user }, { $set: { status: "BLOCKED" } });
  await Employee.deleteOne({ _id: employee._id });
  return { id: employeeId, deactivated: false };
}

/** Congé sur des journées entières ; refusé si un rendez-vous tombe dans la période */
export async function addLeave(actor: Actor, employeeId: string, input: LeaveInput) {
  const employee = await ownEmployee(actor, employeeId);
  const id = await createTimeOff(employee._id.toString(), tunisToUtc(input.from, "00:00"), tunisToUtc(addDays(input.to, 1), "00:00"), input.label);
  if (!id) throw conflict("SLOT_TAKEN", "Un rendez-vous ou un autre blocage tombe pendant ce congé.");
  return { id };
}

/** AUTH-07 : le gérant crée le compte de connexion ; le mot de passe temporaire est affiché une fois et envoyé par e-mail */
export async function createEmployeeAccount(actor: Actor, employeeId: string, email: string) {
  const employee = await ownEmployee(actor, employeeId);
  if (employee.user) throw conflict("HAS_ACCOUNT", "Ce professionnel a déjà un compte.");
  const [firstName, ...rest] = employee.name.split(" ");
  const account = await createStaffAccount({ email, firstName, lastName: rest.join(" ") });
  await Employee.updateOne({ _id: employee._id }, { $set: { user: objectId(account.id) } });
  await sendEmail(
    account.email,
    "Votre compte Glowy",
    `Bonjour ${employee.name},\n\nVotre salon vous a créé un compte Glowy pour consulter votre planning.\nIdentifiant : ${account.email}\nMot de passe temporaire : ${account.temporaryPassword}\n\nConnectez-vous sur /connexion puis changez votre mot de passe.`
  );
  return { email: account.email, temporaryPassword: account.temporaryPassword };
}

/** Retire l'accès : le compte est bloqué et détaché du salon */
export async function revokeEmployeeAccount(actor: Actor, employeeId: string) {
  const employee = await ownEmployee(actor, employeeId);
  if (!employee.user) throw notFound("Ce professionnel n'a pas de compte.");
  await User.updateOne({ _id: employee.user }, { $set: { status: "BLOCKED" } });
  await Employee.updateOne({ _id: employee._id }, { $set: { user: null } });
  return { id: employeeId };
}
