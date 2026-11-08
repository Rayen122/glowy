import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { isWeakPassword } from "@/core/domain/password";
import { addDays, isIsoDate, tunisToday } from "@/core/domain/time";
import { DATE } from "@/core/schemas";
import { Booking, PointTransaction, Review, User } from "@/infrastructure/db";
import { hit } from "@/infrastructure/rate-limit";
import { icsEvent } from "@/lib/calendar";
import { createBooking, createBookingModule, setBookingStatus } from "@/modules/booking";
import { changePassword, hashPassword, sessionUser } from "@/modules/identity";
import { createReview } from "@/modules/reviews";
import { afterVisit, closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

/** Corrections de la campagne de recette du 7 novembre 2026 (docs/RECETTE-2026-11-07.md, QA2-xx) */
const input = (over: Partial<Parameters<typeof createBooking>[1]> = {}) => ({
  salonSlug: "salon-test",
  serviceKeys: ["coupe"],
  employee: "any",
  date: FUTURE_MONDAY,
  time: "10:00",
  paymentMethod: "ONSITE" as const,
  ...over,
});
const code = (expected: string) => (e: AppError) => e instanceof AppError && e.code === expected;

describe("Recette 2026-11-07 : règles pures", () => {
  test("QA2-02 : seules les vraies dates passent (jamais d'erreur 500)", () => {
    for (const bad of ["2026-13-45", "2026-02-30", "2026-00-10", "abc"]) {
      assert.equal(isIsoDate(bad), false, bad);
      assert.equal(DATE.safeParse(bad).success, false, bad);
    }
    assert.equal(isIsoDate("2028-02-29"), true);
  });

  test("QA2-20 : mots de passe trop simples refusés", () => {
    for (const weak of ["aaaaaaaa", "12345678", "motdepasse", "Motdepasse1", "abcdefgh", "court1"]) assert.equal(isWeakPassword(weak), true, weak);
    for (const ok of ["Glowy-QA-2026", "BeautyHub2026!", "jasmin#Tunis7"]) assert.equal(isWeakPassword(ok), false, ok);
  });

  test("QA2-07 : limitation de débit par fenêtre glissante", () => {
    const now = Date.parse("2030-01-01T10:00:00Z");
    for (let i = 0; i < 6; i++) assert.equal(hit("chat", "ip-test", now + i), true);
    assert.equal(hit("chat", "ip-test", now + 10), false, "7e message dans la minute");
    assert.equal(hit("chat", "autre-ip", now + 10), true, "compteur par adresse");
    assert.equal(hit("chat", "ip-test", now + 61_000), true, "fenêtre d'une minute écoulée");
  });

  test("QA2-08 : fichier agenda .ics valide", () => {
    const ics = icsEvent({ title: "Coupe, brushing; soin", start: new Date("2030-01-07T09:00:00Z"), end: new Date("2030-01-07T09:45:00Z"), location: "12 av. Bourguiba" });
    assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
    assert.match(ics, /DTSTART:20300107T090000Z/);
    assert.match(ics, /DTEND:20300107T094500Z/);
    assert.match(ics, /SUMMARY:Coupe\\, brushing\\; soin/);
    assert.match(ics, /END:VCALENDAR$/);
  });
});

describe("Recette 2026-11-07 : réservation", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("QA2-03 : heure hors de la grille de 30 min refusée", async () => {
    await makeSalon();
    const client = await makeUser();
    await assert.rejects(createBooking(client.id, input({ time: "11:07" })), code("OFF_GRID"));
    await createBooking(client.id, input({ time: "11:30" }));
  });

  test("QA2-19 : pas de réservation au-delà de 90 jours", async () => {
    await makeSalon();
    const client = await makeUser();
    await assert.rejects(createBooking(client.id, input({ date: addDays(tunisToday(), 120) })), code("TOO_FAR"));
  });

  test("QA2-04 : une cliente ne peut pas avoir deux rendez-vous qui se chevauchent, même dans deux salons", async () => {
    await makeSalon("salon-test");
    await makeSalon("salon-b");
    const client = await makeUser();
    await createBooking(client.id, input({ employee: "amira" }));
    await assert.rejects(createBooking(client.id, input({ employee: "nour" })), code("CLIENT_BUSY"));
    await assert.rejects(createBooking(client.id, input({ salonSlug: "salon-b" })), code("CLIENT_BUSY"));
    await createBooking(client.id, input({ time: "10:30" })); // juste après : accepté
  });

  test("QA2-07 : au plus 3 demandes en attente par cliente", async () => {
    await makeSalon();
    const client = await makeUser();
    for (const time of ["09:00", "10:00", "11:00"]) await createBooking(client.id, input({ time }));
    await assert.rejects(createBooking(client.id, input({ time: "12:00" })), code("TOO_MANY_PENDING"));
  });

  test("QA2-05 / QA2-12 : après l'heure, ni annulation par la cliente ni confirmation par le salon ; la demande expire", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    const pending = await createBooking(client.id, input());
    const confirmed = await createBooking(client.id, input({ time: "14:00" }));
    await setBookingStatus(confirmed.id, owner, "confirm");

    await assert.rejects(afterVisit.cancelBooking(confirmed.id, client), code("ALREADY_STARTED"));
    await assert.rejects(afterVisit.setBookingStatus(pending.id, owner, "confirm"), code("TOO_LATE"));
    assert.equal(await afterVisit.expireStaleRequests(), 1);
    assert.equal((await Booking.findById(pending.id).orFail()).status, "CANCELLED");
    assert.equal((await Booking.findById(confirmed.id).orFail()).status, "CONFIRMED", "un rendez-vous confirmé n'expire pas");
    // Le salon garde la main : il pointe la visite
    await afterVisit.setBookingStatus(confirmed.id, owner, "noShow");
  });

  test("QA2-06 : l'avis d'une cliente marquée absente est retiré et ses points repris", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    const booking = await createBooking(client.id, input());
    await setBookingStatus(booking.id, owner, "confirm");
    // Le rendez-vous a eu lieu il y a 2 h : avis possible dès son heure, avant le pointage du salon
    const startsAt = new Date(Date.now() - 2 * 3_600_000);
    await Booking.updateOne({ _id: booking.id }, { $set: { startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000) } });
    const review = await createReview(client, { bookingId: booking.id, rating: 1, text: "Service nul, jamais je ne reviendrai.", lang: "fr" });
    const earned = (await PointTransaction.find({ user: client.id, review: review.id })).reduce((a, t) => a + t.points, 0);
    assert.ok(earned > 0, "points de l'avis crédités");

    await createBookingModule().setBookingStatus(booking.id, owner, "noShow");
    assert.equal((await Review.findById(review.id).orFail()).status, "HIDDEN");
    const left = (await PointTransaction.find({ user: client.id, review: review.id })).reduce((a, t) => a + t.points, 0);
    assert.equal(left, 0, "points de l'avis repris");
  });
});

describe("Recette 2026-11-07 : sessions", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("QA2-10 : changer de mot de passe ferme les sessions ouvertes avant", async () => {
    const { id } = await makeUser();
    await User.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword("AncienMotDePasse1") } });
    const openedBefore = Date.now() - 60_000;
    assert.ok(await sessionUser(id, openedBefore), "session valide avant le changement");
    await changePassword(id, "AncienMotDePasse1", "NouveauMotDePasse2");
    assert.equal(await sessionUser(id, openedBefore), null, "ancienne session refusée");
    assert.ok(await sessionUser(id, Date.now() + 1), "nouvelle connexion acceptée");
  });
});
