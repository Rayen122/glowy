import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { manualClock } from "@/core/domain/clock";
import { AppError } from "@/core/domain/errors";
import { tunisToUtc } from "@/core/domain/time";
import { Booking, Promotion, Redemption, Reward, SalonWallet, User } from "@/infrastructure/db";
import { cancelBooking, createBooking, createBookingModule, setBookingStatus } from "@/modules/booking";
import { redeem } from "@/modules/loyalty";
import { checkPromotion, createPromotion, discountFor, promotionInput, redeemAtCounter, redeemSalonReward, salonWallets, setSalonPointsPerVisit, type PromotionRule } from "@/modules/promotions";
import { closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const rule = (extra: Partial<PromotionRule> = {}): PromotionRule => ({
  id: "x",
  kind: "CODE",
  code: "TEST",
  label: "Test",
  percent: 10,
  amount: null,
  minTotal: 0,
  startsOn: null,
  endsOn: null,
  withinHours: null,
  maxUses: null,
  uses: 0,
  active: true,
  ...extra,
});

const booking = (salonSlug: string, extra: Record<string, unknown> = {}) => ({
  salonSlug,
  serviceKeys: ["balayage"],
  employee: "amira",
  date: FUTURE_MONDAY,
  time: "10:00",
  paymentMethod: "ONLINE" as const,
  ...extra,
});

describe("Promotions et récompenses du salon (SAL-10, FID-06)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("règles : remise arrondie et plafonnée, période, minimum, utilisations, fenêtre de dernière minute", () => {
    assert.equal(discountFor({ percent: 15, amount: null }, 35), 5);
    assert.equal(discountFor({ percent: null, amount: 50 }, 20), 20, "jamais plus que le prix");
    const ctx = { subtotal: 100, startsAt: new Date("2026-10-20T12:00:00Z"), now: new Date("2026-10-20T09:00:00Z") };
    assert.equal(checkPromotion(rule(), ctx), "OK");
    assert.equal(checkPromotion(rule({ active: false }), ctx), "INACTIVE");
    assert.equal(checkPromotion(rule({ startsOn: "2026-10-21" }), ctx), "NOT_STARTED");
    assert.equal(checkPromotion(rule({ endsOn: "2026-10-19" }), ctx), "EXPIRED");
    assert.equal(checkPromotion(rule({ maxUses: 3, uses: 3 }), ctx), "EXHAUSTED");
    assert.equal(checkPromotion(rule({ minTotal: 150 }), ctx), "MIN_TOTAL");
    assert.equal(checkPromotion(rule({ kind: "LAST_MINUTE", withinHours: 2 }), ctx), "NOT_LAST_MINUTE", "créneau dans 3 h");
    assert.equal(checkPromotion(rule({ kind: "LAST_MINUTE", withinHours: 3 }), ctx), "OK");
    assert.equal(promotionInput.safeParse({ kind: "CODE", label: "Sans code", percent: 10 }).success, false);
    assert.equal(promotionInput.safeParse({ kind: "CODE", code: "ok10", label: "Deux remises", percent: 10, amount: 5 }).success, false);
  });

  test("un code promo réduit le prix et l'acompte, s'épuise, et redevient disponible à l'annulation", async () => {
    const { salon } = await makeSalon("salon-a");
    const client = await makeUser();
    const other = await makeUser();
    await createPromotion(salon.id, promotionInput.parse({ kind: "CODE", code: "bienvenue 20", label: "−20 %", percent: 20, maxUses: 1 }));

    await assert.rejects(createBooking(client.id, booking("salon-a", { promoCode: "INCONNU" })), (e: AppError) => e.code === "PROMO_UNKNOWN");
    const first = await createBooking(client.id, booking("salon-a", { promoCode: "Bienvenue20" }));
    assert.equal(first.totalPrice, 120, "150 − 20 %");
    assert.equal(first.discount, 30);
    assert.equal(first.deposit, 24, "acompte de 20 % sur le prix remisé");
    assert.equal((await Booking.findById(first.id).orFail()).promo?.code, "BIENVENUE20");

    await assert.rejects(createBooking(other.id, booking("salon-a", { promoCode: "BIENVENUE20", time: "14:00" })), (e: AppError) => e.code === "PROMO_EXHAUSTED");
    await cancelBooking(first.id, client);
    assert.equal((await Promotion.findOne({ code: "BIENVENUE20" }).orFail()).uses, 0);
    const again = await createBooking(other.id, booking("salon-a", { promoCode: "BIENVENUE20", time: "14:00" }));
    assert.equal(again.discount, 30);
  });

  test("l'offre de dernière minute s'applique seule aux créneaux proches", async () => {
    const { salon } = await makeSalon("salon-a");
    const client = await makeUser();
    await createPromotion(salon.id, promotionInput.parse({ kind: "LAST_MINUTE", label: "Dernière minute", amount: 25, withinHours: 3 }));
    const clock = manualClock(tunisToUtc(FUTURE_MONDAY, "08:30"));
    const { createBooking: bookAt, quoteBooking } = createBookingModule({ clock });

    const soon = await bookAt(client.id, booking("salon-a", { time: "10:00" }));
    assert.equal(soon.discount, 25);
    const later = await bookAt(client.id, booking("salon-a", { time: "15:00", employee: "nour" }));
    assert.equal(later.discount, 0, "créneau à plus de 3 h");
    const quote = await quoteBooking("salon-a", { services: "coupe", date: FUTURE_MONDAY, time: "11:00", paymentMethod: "ONSITE" });
    assert.deepEqual({ discount: quote.discount, total: quote.total }, { discount: 20, total: 0 }, "remise plafonnée au prix de la coupe");

    // Un code moins avantageux que l'offre du moment : la cliente garde la meilleure remise, le code n'est pas consommé
    await createPromotion(salon.id, promotionInput.parse({ kind: "CODE", code: "PETIT5", label: "−5 %", percent: 5 }));
    const best = await bookAt(client.id, booking("salon-a", { time: "11:00", employee: "nour", promoCode: "PETIT5" }));
    assert.equal(best.discount, 25);
    assert.equal((await Promotion.findOne({ code: "PETIT5" }).orFail()).uses, 0);
  });

  test("code de récompense validé une seule fois, et seulement dans le salon concerné", async () => {
    const { salon } = await makeSalon("salon-a");
    const other = await makeSalon("salon-b");
    const client = await makeUser();
    const reward = await Reward.create({ salon: salon.id, label: "Brushing offert", cost: 300 });
    await Redemption.create({ user: client.id, reward: reward._id, points: 300, code: "BH-ABC123" });

    await assert.rejects(redeemAtCounter(other.salon.id, "BH-ABC123"), (e: AppError) => e.status === 404);
    const used = await redeemAtCounter(salon.id, "bh-abc123");
    assert.equal(used.reward, "Brushing offert");
    await assert.rejects(redeemAtCounter(salon.id, "BH-ABC123"), (e: AppError) => e.code === "ALREADY_USED");
  });

  test("points salon : crédités une fois par visite terminée, échangés contre une récompense du salon uniquement", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const client = await makeUser();
    await User.updateOne({ _id: client.id }, { $set: { "loyalty.balance": 5000 } });
    await setSalonPointsPerVisit(salon.id, 60);
    const reward = await Reward.create({ salon: salon.id, label: "Brushing offert", cost: 100 });

    for (const time of ["10:00", "14:00"]) {
      const b = await createBooking(client.id, booking("salon-a", { time, paymentMethod: "ONSITE" }));
      await setBookingStatus(b.id, owner, "complete");
    }
    const [wallet] = await salonWallets(client.id);
    assert.equal(wallet.balance, 120);
    assert.deepEqual(wallet.rewards.map((r) => r.label), ["Brushing offert"]);

    // Les points Glowy ne servent pas pour une récompense de salon
    await assert.rejects(redeem(client.id, reward._id.toString()), (e: AppError) => e.status === 404);
    const { code } = await redeemSalonReward(client.id, reward._id.toString());
    assert.match(code, /^SP-/);
    assert.equal((await SalonWallet.findOne({ user: client.id }).orFail()).balance, 20);
    await assert.rejects(redeemSalonReward(client.id, reward._id.toString()), (e: AppError) => e.code === "INSUFFICIENT_POINTS");
    assert.equal((await redeemAtCounter(salon.id, code)).reward, "Brushing offert");
  });
});
