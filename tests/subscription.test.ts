import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { AuditLog, Notification, PlanPayment, Salon } from "@/infrastructure/db";
import { decidePayment, decidePaymentInput, requestPlan } from "@/modules/subscription";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

const request = { plan: "pro" as const, channel: "VIREMENT" as const, reference: "VIR-2026-0042" };
const DAY = 86_400_000;

describe("Abonnements : le Super Admin accepte le paiement (ADM-05)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("le gérant déclare son paiement : demande en attente, le plan reste gratuit, une seule demande à la fois", async () => {
    const { owner } = await makeSalon();
    const payment = await requestPlan(owner, request);
    assert.equal(payment.status, "PENDING");
    assert.equal(payment.amount, 79);
    assert.equal((await Salon.findOne({ slug: "salon-test" }).orFail().lean()).plan, "gratuit");
    await assert.rejects(requestPlan(owner, { ...request, plan: "premium" }), (e: AppError) => e.code === "PENDING_EXISTS");
  });

  test("seul le gérant peut demander un plan", async () => {
    await makeSalon();
    const client = await makeUser();
    await assert.rejects(requestPlan(client, request), (e: AppError) => e.status === 403);
  });

  test("acceptation : plan actif 30 jours, décision journalisée, gérant notifié", async () => {
    const { owner } = await makeSalon();
    const admin = await makeUser("ADMIN");
    const payment = await requestPlan(owner, request);

    await assert.rejects(decidePayment(owner, payment.id, { action: "accept" }), (e: AppError) => e.status === 403);
    const accepted = await decidePayment(admin, payment.id, { action: "accept" });
    assert.equal(accepted.status, "ACCEPTED");

    const salon = await Salon.findOne({ slug: "salon-test" }).orFail().lean();
    assert.equal(salon.plan, "pro");
    const days = (salon.planUntil!.getTime() - Date.now()) / DAY;
    assert.ok(days > 29.9 && days <= 30, `échéance à ${days} jours`);
    assert.equal(await AuditLog.countDocuments({ action: "payment.accept", targetId: payment.id }), 1);
    assert.equal(await Notification.countDocuments({ user: owner.id, type: "plan.decided", title: "Paiement accepté" }), 1);
  });

  test("refus : motif obligatoire, le plan reste gratuit, le gérant peut refaire une demande", async () => {
    const { owner } = await makeSalon();
    const admin = await makeUser("ADMIN");
    const payment = await requestPlan(owner, request);

    assert.equal(decidePaymentInput.safeParse({ action: "refuse" }).success, false);
    await decidePayment(admin, payment.id, { action: "refuse", reason: "Virement introuvable" });
    assert.equal((await Salon.findOne({ slug: "salon-test" }).orFail().lean()).plan, "gratuit");
    assert.equal((await PlanPayment.findById(payment.id).orFail().lean()).reason, "Virement introuvable");
    assert.equal(await Notification.countDocuments({ user: owner.id, title: "Paiement refusé" }), 1);

    const retry = await requestPlan(owner, request);
    assert.equal(retry.status, "PENDING");
  });

  test("un paiement ne se traite qu'une fois, même avec deux décisions simultanées", async () => {
    const { owner } = await makeSalon();
    const [a, b] = await Promise.all([makeUser("ADMIN"), makeUser("ADMIN")]);
    const payment = await requestPlan(owner, request);

    const results = await Promise.allSettled([decidePayment(a, payment.id, { action: "accept" }), decidePayment(b, payment.id, { action: "accept" })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const refused = results.find((r) => r.status === "rejected");
    assert.ok(refused?.status === "rejected" && refused.reason instanceof AppError && refused.reason.code === "ALREADY_DECIDED");
    assert.equal(await AuditLog.countDocuments({ action: "payment.accept" }), 1);
  });

  test("plan déjà actif : pas de nouveau paiement tant que l'échéance est loin ; renouvellement prolonge la période", async () => {
    const { owner } = await makeSalon();
    const admin = await makeUser("ADMIN");
    await decidePayment(admin, (await requestPlan(owner, request)).id, { action: "accept" });
    await assert.rejects(requestPlan(owner, request), (e: AppError) => e.code === "ALREADY_ACTIVE");

    // Échéance dans 3 jours : renouvellement autorisé, prolongé à partir de l'échéance
    const soon = new Date(Date.now() + 3 * DAY);
    await Salon.updateOne({ slug: "salon-test" }, { $set: { planUntil: soon } });
    const renewal = await requestPlan(owner, request);
    await decidePayment(admin, renewal.id, { action: "accept" });
    const until = (await Salon.findOne({ slug: "salon-test" }).orFail().lean()).planUntil!;
    assert.ok(Math.abs(until.getTime() - (soon.getTime() + 30 * DAY)) < 5_000);
  });
});
