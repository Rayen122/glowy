import { Types } from "mongoose";
import { tunisDayRange, weekdayOf } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Salon, SlotLock, TimeOff, type BookingDoc } from "@/infrastructure/db";
import type { DaySchedule, Interval } from "../domain/availability";
import { ACTIVE_STATUSES, isActive, lockSlices } from "../domain/policy";
import type { BookingRecord, BookingRepository } from "../application/ports";
import { acquireSlices, releaseSlices } from "./slot-locks";

export const toBookingRecord = (b: BookingDoc): BookingRecord => ({
  id: idOf(b),
  clientId: b.client.toString(),
  salonId: b.salon.toString(),
  employeeId: b.employee.toString(),
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  status: b.status,
  totalPrice: b.totalPrice,
  deposit: b.deposit,
  paymentMethod: b.paymentMethod,
  offPeak: b.offPeak,
  note: b.note ?? null,
  cancelledAt: b.cancelledAt ?? null,
  completedAt: b.completedAt ?? null,
  createdAt: b.createdAt,
});

const after = { returnDocument: "after" as const };

export const mongoBookingRepository: BookingRepository = {
  async salonBySlug(slug) {
    const salon = await Salon.findOne({ slug }, { status: 1 }).lean();
    return salon ? { id: idOf(salon), active: salon.status === "ACTIVE" } : null;
  },

  async salonPolicy(salonId) {
    const salon = await Salon.findById(objectId(salonId), { cancellationHours: 1 }).orFail().lean();
    return { cancellationHours: salon.cancellationHours };
  },

  async activeServices(salonId, keys) {
    const salon = await Salon.findById(objectId(salonId), { services: 1 }).lean();
    return (salon?.services ?? [])
      .filter((s) => s.active && keys.includes(s.key))
      .map((s) => ({ key: s.key, name: s.name, price: s.price, durationMin: s.durationMin }));
  },

  async daySchedule(salonId, date, opts = {}) {
    const weekday = weekdayOf(date);
    const salon = objectId(salonId);
    const [salonDoc, employees] = await Promise.all([
      Salon.findById(salon, { openingHours: 1 }).lean(),
      Employee.find({
        salon,
        active: true,
        ...(opts.employeeKey ? { key: opts.employeeKey } : {}),
        ...(opts.employeeId ? { _id: objectId(opts.employeeId) } : {}),
      })
        .sort({ createdAt: 1 })
        .lean(),
    ]);
    const { start, end } = tunisDayRange(date);
    const ids = employees.map((e) => e._id);
    const ignore = objectId(opts.ignoreBookingId);
    const [booked, timeOff] = await Promise.all([
      Booking.find(
        { employee: { $in: ids }, status: { $in: ACTIVE_STATUSES }, startsAt: { $lt: end }, endsAt: { $gt: start }, ...(ignore ? { _id: { $ne: ignore } } : {}) },
        { employee: 1, startsAt: 1, endsAt: 1 }
      ).lean(),
      TimeOff.find({ employee: { $in: ids }, startsAt: { $lt: end }, endsAt: { $gt: start } }, { employee: 1, startsAt: 1, endsAt: 1 }).lean(),
    ]);
    const busy = new Map<string, Interval[]>();
    for (const item of [...booked, ...timeOff]) {
      const key = item.employee.toString();
      busy.set(key, [...(busy.get(key) ?? []), { start: item.startsAt.getTime(), end: item.endsAt.getTime() }]);
    }
    const opening = salonDoc?.openingHours.find((o) => o.weekday === weekday);
    return {
      date,
      weekday,
      opening: opening?.opensAt && opening.closesAt ? { opensAt: opening.opensAt, closesAt: opening.closesAt } : null,
      employees: employees.map((e) => {
        const own = e.workingHours.find((w) => w.weekday === weekday);
        return { id: idOf(e), key: e.key, workingHours: own?.startsAt && own.endsAt ? { startsAt: own.startsAt, endsAt: own.endsAt } : null };
      }),
      busy,
    } satisfies DaySchedule;
  },

  async insertIfFree(data) {
    const _id = new Types.ObjectId();
    const employee = objectId(data.employeeId)!;
    if (!(await acquireSlices(employee, data.startsAt, data.endsAt, { booking: _id }))) return null;
    try {
      const booking = await Booking.create({
        _id,
        client: objectId(data.clientId)!,
        salon: objectId(data.salonId)!,
        employee,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: "CONFIRMED",
        totalPrice: data.totalPrice,
        deposit: data.deposit,
        paymentMethod: data.paymentMethod,
        note: data.note,
        offPeak: data.offPeak,
        items: data.items.map((s) => ({ serviceKey: s.key, name: s.name, price: s.price, durationMin: s.durationMin })),
        // Paiement en mode test : aucune donnée de carte ne transite ni n'est stockée
        payment: data.deposit > 0 ? { amount: data.deposit, status: "PAID", provider: "test", reference: `TEST-${_id.toString().slice(-8).toUpperCase()}` } : null,
      });
      return toBookingRecord(booking.toObject());
    } catch (error) {
      await releaseSlices({ booking: _id });
      throw error;
    }
  },

  async findById(id) {
    const _id = objectId(id);
    const booking = _id ? await Booking.findById(_id).lean() : null;
    return booking ? toBookingRecord(booking) : null;
  },

  async cancel(id, at, refund) {
    const _id = objectId(id)!;
    const booking = await Booking.findOneAndUpdate(
      { _id, status: { $in: ACTIVE_STATUSES } },
      { $set: { status: "CANCELLED", cancelledAt: at } },
      after
    ).lean();
    if (!booking) return null;
    if (refund) await Booking.updateOne({ _id, "payment.status": "PAID" }, { $set: { "payment.status": "REFUNDED" } });
    await releaseSlices({ booking: _id });
    return toBookingRecord(booking);
  },

  async moveIfFree(id, startsAt, endsAt, offPeak) {
    const _id = objectId(id)!;
    const current = await Booking.findById(_id).orFail().lean();
    // Les tranches déjà tenues par cette réservation ne sont pas reprises (report qui chevauche l'ancien créneau)
    const owned = new Set((await SlotLock.find({ booking: _id }, { at: 1 }).lean()).map((l) => l.at.getTime()));
    if (!(await acquireSlices(current.employee, startsAt, endsAt, { booking: _id }, owned))) return null;
    const kept = lockSlices(startsAt, endsAt).map((d) => d.getTime());
    await SlotLock.deleteMany({ booking: _id, at: { $nin: kept.map((t) => new Date(t)) } });
    const moved = await Booking.findByIdAndUpdate(_id, { $set: { startsAt, endsAt, offPeak } }, after).orFail().lean();
    return toBookingRecord(moved);
  },

  async setStatus(id, from, to, at) {
    const _id = objectId(id)!;
    const booking = await Booking.findOneAndUpdate(
      { _id, status: from },
      { $set: { status: to, ...(to === "COMPLETED" ? { completedAt: at } : {}) } },
      after
    ).lean();
    if (!booking) return null;
    if (!isActive(to)) await releaseSlices({ booking: _id });
    return toBookingRecord(booking);
  },
};

/** Congé ou pause d'un employé (agenda) : bloque les mêmes tranches que les réservations */
export async function createTimeOff(employeeId: string, startsAt: Date, endsAt: Date, label: string) {
  const _id = new Types.ObjectId();
  const employee = objectId(employeeId)!;
  if (!(await acquireSlices(employee, startsAt, endsAt, { timeOff: _id }))) return null;
  await TimeOff.create({ _id, employee, startsAt, endsAt, label });
  return idOf(_id);
}

/** Supprime un blocage et libère ses tranches */
export async function deleteTimeOff(timeOffId: string) {
  const _id = objectId(timeOffId)!;
  await releaseSlices({ timeOff: _id });
  await TimeOff.deleteOne({ _id });
}
