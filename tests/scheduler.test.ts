import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { Booking, Employee, Notification, OutboxMessage, PointTransaction, User } from "@/infrastructure/db";
import { award, expireInactivePoints, warnExpiringPoints } from "@/modules/loyalty";
import { sendReminders } from "@/modules/notifications";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

const HOUR = 3_600_000;

async function bookingIn(salonId: string, clientId: string, startsInHours: number, bookedHoursAgo: number) {
  const employee = await Employee.findOne({ salon: salonId }).orFail();
  const startsAt = new Date(Date.now() + startsInHours * HOUR);
  return Booking.create({
    client: clientId,
    salon: salonId,
    employee: employee._id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    totalPrice: 20,
    items: [{ serviceKey: "coupe", name: "Coupe", price: 20, durationMin: 30 }],
    createdAt: new Date(Date.now() - bookedHoursAgo * HOUR),
  });
}

describe("Tâches planifiées : rappels (RES-07) et expiration des points (FID-07)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("rappel la veille puis 2 h avant, par e-mail, SMS et notification, jamais deux fois", async () => {
    const { salon } = await makeSalon("salon-a");
    const client = await makeUser();
    await User.updateOne({ _id: client.id }, { $set: { phone: "+216 20 000 000" } });
    const booking = await bookingIn(salon.id, client.id, 20, 48);

    assert.equal(await sendReminders(), 1);
    assert.equal(await sendReminders(), 0, "pas de doublon");
    assert.deepEqual((await OutboxMessage.find().lean()).map((m) => m.channel).sort(), ["email", "sms"]);
    assert.equal(await Notification.countDocuments({ user: client.id, type: "booking.reminder" }), 1);

    // 1 h 30 avant : rappel « dans 2 heures »
    assert.equal(await sendReminders(new Date(booking.startsAt.getTime() - 1.5 * HOUR)), 1);
    assert.ok((await Booking.findById(booking._id).orFail()).reminders?.hour);
  });

  test("pas de rappel de la veille pour un rendez-vous pris moins de 24 h avant, ni pour un rendez-vous annulé", async () => {
    const { salon } = await makeSalon("salon-a");
    const client = await makeUser();
    await bookingIn(salon.id, client.id, 20, 1);
    const cancelled = await bookingIn(salon.id, client.id, 10, 48);
    await Booking.updateOne({ _id: cancelled._id }, { $set: { status: "CANCELLED" } });
    assert.equal(await sendReminders(), 0);
  });

  test("préavis un mois avant l'expiration, puis expiration après 12 mois sans activité", async () => {
    const warned = await makeUser();
    const stale = await makeUser();
    const month = 30 * 24 * HOUR;
    await User.updateOne({ _id: warned.id }, { $set: { "loyalty.balance": 120, "loyalty.lastActivityAt": new Date(Date.now() - 11.5 * month) } });
    await User.updateOne({ _id: stale.id }, { $set: { "loyalty.balance": 80, "loyalty.lastActivityAt": new Date(Date.now() - 13 * month) } });

    assert.equal(await warnExpiringPoints(), 1);
    assert.equal(await warnExpiringPoints(), 0, "une seule fois par période d'inactivité");
    assert.equal(await Notification.countDocuments({ user: warned.id, type: "points.expiring" }), 1);

    assert.equal(await expireInactivePoints(), 1);
    assert.equal((await User.findById(stale.id).orFail()).loyalty?.balance, 0);
    assert.equal(await PointTransaction.countDocuments({ user: stale.id, reason: "EXPIRATION", points: -80 }), 1);
    assert.equal(await Notification.countDocuments({ user: stale.id, type: "points.expired" }), 1);
  });

  test("anti-fraude : au plus 5 gains par jour pour un même type d'action", async () => {
    const client = await makeUser();
    const gains = [];
    for (let i = 0; i < 6; i += 1) gains.push(await award(client.id, "OFF_PEAK"));
    assert.deepEqual(gains, [10, 10, 10, 10, 10, 0]);
    assert.equal(await award(client.id, "NO_SHOW"), -20, "les pénalités ne sont jamais plafonnées");
  });
});
