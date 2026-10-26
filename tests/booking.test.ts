import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { tunisToUtc } from "@/core/domain/time";
import { AppError } from "@/core/domain/errors";
import { manualClock } from "@/core/domain/clock";
import { Booking, Employee, isDuplicateKey, SlotLock, TimeOff, User } from "@/infrastructure/db";
import { cancelBooking, createBooking, createBookingModule, createTimeOff, getAvailability, setBookingStatus } from "@/modules/booking";
import { afterVisit, closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const input = (over: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
  salonSlug: "salon-test",
  serviceKeys: ["coupe"],
  employee: "amira",
  date: FUTURE_MONDAY,
  time: "10:00",
  paymentMethod: "ONSITE" as const,
  ...over,
});

describe("Réservation et anti double réservation (RES-03, RES-04)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("10 réservations simultanées du même créneau : une seule réussit", async () => {
    await makeSalon();
    const clients = await Promise.all(Array.from({ length: 10 }, () => makeUser()));
    const results = await Promise.allSettled(clients.map((c) => createBooking(c.id, input())));

    const ok = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(refused.length, 9);
    for (const r of refused) {
      assert.ok(r.reason instanceof AppError && r.reason.code === "SLOT_TAKEN", String(r.reason));
    }
    assert.equal(await Booking.countDocuments(), 1);
  });

  test("créneaux qui se chevauchent refusés, créneaux adjacents acceptés", async () => {
    await makeSalon();
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    await createBooking(a.id, input({ serviceKeys: ["balayage"], time: "10:00" })); // 10:00–12:00
    await assert.rejects(createBooking(b.id, input({ time: "11:30" })), (e: AppError) => e.code === "SLOT_TAKEN");
    await createBooking(c.id, input({ time: "12:00" })); // commence pile à la fin : accepté
  });

  test("« premier disponible » bascule sur l'employée libre", async () => {
    await makeSalon();
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const first = await createBooking(a.id, input({ employee: "any" }));
    const second = await createBooking(b.id, input({ employee: "any" }));
    assert.notEqual(first.employeeId, second.employeeId);
  });

  test("l'index unique des tranches refuse un chevauchement même sans passer par le service", async () => {
    await makeSalon();
    const client = await makeUser();
    const booking = await createBooking(client.id, input({ time: "10:00" })); // 10:00–10:30
    // Même tranche pour le même employé, insérée directement : refusée par l'index unique
    await assert.rejects(
      SlotLock.create({ employee: booking.employeeId, at: tunisToUtc(FUTURE_MONDAY, "10:00") }),
      (e: unknown) => isDuplicateKey(e)
    );
    // Un rendez-vous annulé libère le créneau
    await cancelBooking(booking.id, { id: client.id, role: "CLIENT" });
    const other = await makeUser();
    await createBooking(other.id, input({ time: "10:00" }));
  });

  test("les disponibilités excluent les créneaux pris et les congés", async () => {
    const { salon } = await makeSalon();
    const client = await makeUser();
    await createBooking(client.id, input({ time: "09:00" }));
    const amira = await Employee.findOne({ key: "amira" }).orFail();
    assert.ok(await createTimeOff(amira._id.toString(), tunisToUtc(FUTURE_MONDAY, "12:00"), tunisToUtc(FUTURE_MONDAY, "13:00"), "Pause"));
    assert.equal(await TimeOff.countDocuments(), 1);

    const { slots } = await getAvailability({ salonId: salon.id, date: FUTURE_MONDAY, durationMin: 30, employeeKey: "amira" });
    const at = (time: string) => slots.find((s) => s.time === time)!;
    assert.deepEqual(at("09:00").employees, []);
    assert.deepEqual(at("12:30").employees, []);
    assert.deepEqual(at("09:30").employees, ["amira"]);
  });

  test("annulation tardive : pénalité de 20 points ; annulation dans les délais : aucune", async () => {
    await makeSalon();
    const client = await makeUser();
    await User.updateOne({ _id: client.id }, { $set: { "loyalty.balance": 100, "loyalty.lifetime": 100 } });
    const booking = await createBooking(client.id, input());

    // 1 h avant le rendez-vous (< 24 h) : tardive
    const clock = manualClock(new Date(booking.startsAt.getTime() - 3_600_000));
    const { cancelBooking: cancelAt } = createBookingModule({ clock });
    const { late } = await cancelAt(booking.id, { id: client.id, role: "CLIENT" });
    assert.equal(late, true);
    assert.equal((await User.findById(client.id).orFail().lean()).loyalty!.balance, 80);

    const other = await createBooking(client.id, input({ time: "15:00" }));
    clock.set(new Date(other.startsAt.getTime() - 3 * 86_400_000));
    const { late: late2 } = await cancelAt(other.id, { id: client.id, role: "CLIENT" });
    assert.equal(late2, false);
  });

  test("seul le personnel du salon peut terminer un rendez-vous, et seulement après son heure", async () => {
    const { owner } = await makeSalon();
    const [client, stranger] = await Promise.all([makeUser(), makeUser("MANAGER")]);
    const booking = await createBooking(client.id, input());
    await assert.rejects(afterVisit.setBookingStatus(booking.id, { id: stranger.id, role: "MANAGER" }, "complete"), (e: AppError) => e.status === 403);
    await assert.rejects(afterVisit.setBookingStatus(booking.id, { id: client.id, role: "CLIENT" }, "complete"), (e: AppError) => e.status === 403);
    // Avant l'heure du rendez-vous : ni terminé, ni absente ; « commencer » au plus tôt 30 min avant
    for (const action of ["complete", "noShow", "start"] as const) {
      await assert.rejects(setBookingStatus(booking.id, { id: owner.id, role: "MANAGER" }, action), (e: AppError) => e.code === "TOO_EARLY");
    }
    const done = await afterVisit.setBookingStatus(booking.id, { id: owner.id, role: "MANAGER" }, "complete");
    assert.equal(done.status, "COMPLETED");
  });
});
