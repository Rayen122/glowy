import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Employee, Salon, SlotLock, TimeOff } from "@/infrastructure/db";
import { createBooking } from "@/modules/booking";
import { blockSlot, blockSlotInput, setupSalon, unblockSlot } from "@/modules/dashboard";
import { salonDay } from "@/modules/dashboard";
import { closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

describe("Agenda du salon : mise en route et blocage de créneaux (SAL-04, SAL-05)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("un salon neuf reçoit ses horaires et le gérant comme premier professionnel, sans jamais rien écraser", async () => {
    const owner = await makeUser("MANAGER");
    await Salon.create({ slug: "neuf", name: "Salon neuf", category: "spa", city: "Tunis", address: "1 rue", lat: 36.8, lng: 10.18, owner: owner.id });

    const first = await setupSalon(owner, "Rayen Borgi");
    assert.deepEqual(first, { hoursCreated: true, employeeCreated: true });
    const salon = await Salon.findOne({ slug: "neuf" }).orFail().lean();
    assert.equal(salon.openingHours.length, 6);
    assert.ok(!salon.openingHours.some((h) => h.weekday === 0), "dimanche fermé");
    assert.equal((await Employee.findOne({ salon: salon._id }).orFail().lean()).name, "Rayen Borgi");

    // Rejouer ne crée rien de plus
    assert.deepEqual(await setupSalon(owner, "Rayen Borgi"), { hoursCreated: false, employeeCreated: false });
    assert.equal(await Employee.countDocuments({ salon: salon._id }), 1);
  });

  test("l'agenda indique les horaires d'ouverture ; un dimanche fermé n'a pas d'horaires", async () => {
    const { salon } = await makeSalon();
    await Salon.updateOne({ _id: salon.id }, { $set: { openingHours: [{ weekday: 1, opensAt: "09:00", closesAt: "19:00" }] } });
    const monday = await salonDay(salon.id, FUTURE_MONDAY);
    assert.deepEqual(monday.opening, { opensAt: "09:00", closesAt: "19:00" });
    const sunday = await salonDay(salon.id, "2030-01-06");
    assert.equal(sunday.opening, null);
  });

  test("bloquer un créneau le rend indisponible à la réservation, le débloquer le libère", async () => {
    const { owner, salon } = await makeSalon();
    const client = await makeUser();
    const amira = await Employee.findOne({ key: "amira" }).orFail();
    const input = { employeeId: amira._id.toString(), date: FUTURE_MONDAY, from: "12:00", to: "13:00", label: "Pause déjeuner" };

    const { id } = await blockSlot(owner, input);
    assert.equal(await TimeOff.countDocuments(), 1);
    const day = await salonDay(salon.id, FUTURE_MONDAY);
    assert.equal(day.blocks.length, 1);
    assert.equal(day.blocks[0].id, id);

    const booking = { salonSlug: "salon-test", serviceKeys: ["coupe"], employee: "amira", date: FUTURE_MONDAY, time: "12:00", paymentMethod: "ONSITE" as const };
    await assert.rejects(createBooking(client.id, booking), (e: AppError) => e.code === "SLOT_TAKEN");

    await unblockSlot(owner, id);
    assert.equal(await TimeOff.countDocuments(), 0);
    assert.equal(await SlotLock.countDocuments({ timeOff: id }), 0);
    await createBooking(client.id, booking);
  });

  test("blocage refusé sur un rendez-vous existant, pour un autre salon, ou avec des heures incohérentes", async () => {
    const { owner } = await makeSalon("salon-a");
    const other = await makeSalon("salon-b");
    const client = await makeUser();
    const amira = await Employee.findOne({ key: "amira", salon: (await Salon.findOne({ slug: "salon-a" }).orFail())._id }).orFail();
    const input = { employeeId: amira._id.toString(), date: FUTURE_MONDAY, from: "10:00", to: "11:00", label: "Congé" };

    await createBooking(client.id, { salonSlug: "salon-a", serviceKeys: ["coupe"], employee: "amira", date: FUTURE_MONDAY, time: "10:00", paymentMethod: "ONSITE" });
    await assert.rejects(blockSlot(owner, input), (e: AppError) => e.code === "SLOT_TAKEN");
    // Un gérant ne peut pas bloquer chez un autre salon
    await assert.rejects(blockSlot(other.owner, { ...input, from: "15:00", to: "16:00" }), (e: AppError) => e.status === 404);
    assert.equal(blockSlotInput.safeParse({ ...input, from: "11:00", to: "10:00" }).success, false);
  });
});
