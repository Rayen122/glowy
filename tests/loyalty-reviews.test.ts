import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { setSalonStatus } from "@/modules/admin";
import { createBooking, setBookingStatus } from "@/modules/booking";
import { AppError } from "@/core/domain/errors";
import { redeem } from "@/modules/loyalty";
import { createReview } from "@/modules/reviews";
import { AuditLog, Booking, Reward, Salon, User } from "@/infrastructure/db";
import { closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const balance = async (userId: string) => ({ balance: (await User.findById(userId).orFail().lean()).loyalty?.balance ?? 0 });

/** 15 h : hors heure creuse. Réservé des années à l'avance → toujours +5 « réservation 48 h à l'avance ». */
async function completedBooking(clientId: string, ownerId: string, time = "15:00", slug = "salon-test") {
  const booking = await createBooking(clientId, { salonSlug: slug, serviceKeys: ["coupe"], employee: "any", date: FUTURE_MONDAY, time, paymentMethod: "ONSITE" });
  await setBookingStatus(booking.id, { id: ownerId, role: "MANAGER" }, "complete");
  return booking;
}

describe("Fidélité, avis vérifiés et Super Admin", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("rendez-vous terminé dans un nouveau salon : +10, +30 nouveau salon, +5 réservé à l'avance (une seule fois)", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    const booking = await completedBooking(client.id, owner.id);
    assert.equal((await balance(client.id)).balance, 45);

    // 2e rendez-vous dans le même salon : pas de bonus « nouveau salon »
    await completedBooking(client.id, owner.id, "17:00");
    assert.equal((await balance(client.id)).balance, 60);

    // Rejouer l'événement ne crédite pas deux fois
    await Booking.updateOne({ _id: booking.id }, { $set: { status: "CONFIRMED" } });
    await setBookingStatus(booking.id, { id: owner.id, role: "MANAGER" }, "complete");
    assert.equal((await balance(client.id)).balance, 60);
  });

  test("heure creuse prédite : +10 supplémentaires", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    await completedBooking(client.id, owner.id, "10:00"); // lundi 10 h
    assert.equal((await balance(client.id)).balance, 45 + 10);
  });

  test("parrainage : +50 pour la filleule et la marraine après le premier rendez-vous terminé", async () => {
    const { owner } = await makeSalon();
    const marraine = await makeUser();
    const filleule = await makeUser("CLIENT", { referredBy: marraine.id });
    await completedBooking(filleule.id, owner.id);
    assert.equal((await balance(filleule.id)).balance, 10 + 30 + 5 + 50);
    assert.equal((await balance(marraine.id)).balance, 50);
  });

  test("bonus de niveau : une cliente Or gagne 20 % de plus", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    await User.updateOne({ _id: client.id }, { $set: { "loyalty.lifetime": 600 } });
    await completedBooking(client.id, owner.id);
    assert.equal((await balance(client.id)).balance, 12 + 36 + 6); // (10 + 30 + 5) × 1,2
  });

  test("avis impossible avant la fin du rendez-vous, une seule fois, +15 pts", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    const pending = await createBooking(client.id, { salonSlug: "salon-test", serviceKeys: ["coupe"], employee: "amira", date: FUTURE_MONDAY, time: "09:00", paymentMethod: "ONSITE" });
    const review = { bookingId: pending.id, rating: 5, text: "Super coupe, très bon accueil.", lang: "fr" as const };
    await assert.rejects(createReview({ id: client.id, role: "CLIENT" }, review), (e: AppError) => e.code === "BOOKING_NOT_COMPLETED");

    await setBookingStatus(pending.id, { id: owner.id, role: "MANAGER" }, "complete");
    const before = (await balance(client.id)).balance;
    await createReview({ id: client.id, role: "CLIENT" }, review);
    assert.equal((await balance(client.id)).balance, before + 15);
    await assert.rejects(createReview({ id: client.id, role: "CLIENT" }, review), (e: AppError) => e.code === "ALREADY_REVIEWED");

    const other = await makeUser();
    await assert.rejects(createReview({ id: other.id, role: "CLIENT" }, review), (e: AppError) => e.status === 404);
    const salon = await Salon.findOne({ slug: "salon-test" }).orFail().lean();
    assert.equal(salon.reviewCount, 1);
    assert.equal(salon.ratingAvg, 5);
  });

  test("échange de points : solde insuffisant refusé, sinon code généré", async () => {
    const client = await makeUser();
    const reward = await Reward.create({ label: "Réduction de 5 DT", cost: 100 });
    const rewardId = reward._id.toString();
    await assert.rejects(redeem(client.id, rewardId), (e: AppError) => e.code === "INSUFFICIENT_POINTS");
    await User.updateOne({ _id: client.id }, { $set: { "loyalty.balance": 150 } });
    const redemption = await redeem(client.id, rewardId);
    assert.match(redemption.code, /^BH-/);
    assert.equal((await balance(client.id)).balance, 50);
  });

  test("validation d'un salon par le Super Admin : actif, vérifié, journalisé", async () => {
    const admin = await makeUser("ADMIN");
    const manager = await makeUser("MANAGER");
    const salon = await Salon.create({ slug: "nouveau", name: "Nouveau salon", category: "ongles", specialties: [], city: "Sfax", address: "Centre", lat: 34.7, lng: 10.7, owner: manager.id });
    const salonId = salon._id.toString();
    await assert.rejects(setSalonStatus({ id: manager.id, role: "MANAGER" }, salonId, { action: "approve" }), (e: AppError) => e.status === 403);
    const approved = await setSalonStatus({ id: admin.id, role: "ADMIN" }, salonId, { action: "approve" });
    assert.equal(approved.status, "ACTIVE");
    assert.equal(approved.verified, true);
    assert.equal(await AuditLog.countDocuments({ action: "salon.approve", targetId: salonId }), 1);
    await assert.rejects(setSalonStatus({ id: admin.id, role: "ADMIN" }, salonId, { action: "approve" }), (e: AppError) => e.code === "INVALID_TRANSITION");
  });
});
