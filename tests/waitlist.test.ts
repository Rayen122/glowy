import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Notification, WaitlistEntry } from "@/infrastructure/db";
import { cancelBooking, createBooking, expireWaitlist, joinWaitlist, leaveWaitlist, myWaitlist } from "@/modules/booking";
import { closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const ALL_DAY = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

describe("Liste d'attente d'un jour complet (RES-09)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("prévenue quand une annulation libère un créneau compatible, une seule fois", async () => {
    await makeSalon("salon-a");
    const booker = await makeUser();
    const waiting = await makeUser();
    // Journée complète pour le balayage (2 h) : les deux professionnelles sont prises de 8 h à 20 h
    const bookings = [];
    for (const employee of ["amira", "nour"]) {
      for (const time of ALL_DAY) bookings.push(await createBooking(booker.id, { salonSlug: "salon-a", serviceKeys: ["balayage"], employee, date: FUTURE_MONDAY, time, paymentMethod: "ONSITE" }));
    }
    await joinWaitlist(waiting.id, "salon-a", { date: FUTURE_MONDAY, serviceKeys: ["balayage"] });
    await assert.rejects(joinWaitlist(waiting.id, "salon-a", { date: FUTURE_MONDAY, serviceKeys: ["balayage"] }), (e: AppError) => e.code === "ALREADY_WAITING");

    await cancelBooking(bookings[2].id, booker);
    assert.equal(await Notification.countDocuments({ user: waiting.id, type: "waitlist.slot" }), 1);
    assert.equal((await myWaitlist(waiting.id))[0].status, "NOTIFIED");
    await cancelBooking(bookings[3].id, booker);
    assert.equal(await Notification.countDocuments({ user: waiting.id, type: "waitlist.slot" }), 1, "pas de doublon");
  });

  test("inscription refusée pour un jour passé ou une prestation inconnue ; sortie et expiration", async () => {
    await makeSalon("salon-a");
    const client = await makeUser();
    await assert.rejects(joinWaitlist(client.id, "salon-a", { date: "2020-01-01", serviceKeys: ["coupe"] }), (e: AppError) => e.code === "PAST_DATE");
    await assert.rejects(joinWaitlist(client.id, "salon-a", { date: FUTURE_MONDAY, serviceKeys: ["inconnue"] }), (e: AppError) => e.code === "UNKNOWN_SERVICE");
    const { id } = await joinWaitlist(client.id, "salon-a", { date: FUTURE_MONDAY, serviceKeys: ["coupe"] });
    await leaveWaitlist(client.id, id);
    assert.equal((await myWaitlist(client.id)).length, 0);
    await WaitlistEntry.create({ salon: (await WaitlistEntry.findById(id).orFail()).salon, client: client.id, date: "2020-01-01", serviceKeys: ["coupe"] });
    assert.equal(await expireWaitlist(), 1);
  });
});
