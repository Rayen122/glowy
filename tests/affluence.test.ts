import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { tunisToUtc } from "@/core/domain/time";
import { Notification } from "@/infrastructure/db";
import { addWalkIn, bestWindow, forecastDay, joinQueue, leaveQueue, liveStatus, myQueueStatus, queueAction, salonQueue, waitFor } from "@/modules/affluence";
import { closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const OPENING = { opensAt: "09:00", closesAt: "13:00" };

describe("Affluence : prévision (IA P2), direct et file d'attente virtuelle (RES-08)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("prévision pondérée sur l'historique, repli sur une courbe type, jour fermé", () => {
    // 2 professionnels ; chaque semaine, 10 h – 11 h complètement occupée
    const week = [{ start: 600, end: 660 }, { start: 600, end: 660 }];
    const { points, source } = forecastDay([week, week, []], 2, OPENING);
    assert.equal(source, "history");
    assert.deepEqual(points.map((p) => p.hour), [9, 10, 11, 12]);
    assert.equal(points.find((p) => p.hour === 10)?.value, 74, "poids 1 ; 0,8 ; 0,64 → (1 + 0,8) / 2,44");
    assert.equal(points.find((p) => p.hour === 9)?.value, 0);
    assert.deepEqual(bestWindow(points), { from: 11, to: 13, value: 0 });
    assert.equal(forecastDay([week], 2, OPENING).source, "fallback", "historique insuffisant");
    assert.deepEqual(forecastDay([week, week], 2, null), { points: [], source: "closed" });
  });

  test("attente estimée : chaque personne prend le premier professionnel libre", () => {
    const ctx = { capacity: 2, busyUntil: [10, 20], avgServiceMin: 30 };
    assert.deepEqual([1, 2, 3, 4].map((p) => waitFor(p, ctx)), [10, 20, 40, 50]);
    assert.equal(waitFor(1, { capacity: 3, busyUntil: [10], avgServiceMin: 30 }), 0, "un professionnel libre");
    assert.equal(liveStatus({ capacity: 2, busyUntil: [10, 20], waiting: 1, avgServiceMin: 30 }).level, "forte");
    assert.equal(liveStatus({ capacity: 4, busyUntil: [10], waiting: 0, avgServiceMin: 30 }).level, "calme");
  });

  test("file d'attente : une place par cliente, positions, appel notifié, sortie", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const [lina, sara] = [await makeUser(), await makeUser()];
    const now = tunisToUtc(FUTURE_MONDAY, "10:00");

    const first = await joinQueue(lina.id, "salon-a", "Coupe", now);
    assert.deepEqual({ position: first?.position, wait: first?.waitMinutes }, { position: 1, wait: 0 });
    await assert.rejects(joinQueue(lina.id, "salon-a", undefined, now), (e: AppError) => e.code === "ALREADY_IN_QUEUE");
    await joinQueue(sara.id, "salon-a", undefined, now);
    await addWalkIn(salon.id, "Mme Ben Ali", undefined);
    const third = await salonQueue(salon.id, now);
    assert.deepEqual(third.waiting.map((w) => [w.position, w.waitMinutes]), [[1, 0], [2, 0], [3, 75]], "2 professionnelles libres ; durée moyenne des prestations (30 + 120) / 2 = 75 min");

    await queueAction(owner, salon.id, first!.id, "call", async (userId, message) => Notification.create({ user: userId, ...message }), now);
    assert.equal((await myQueueStatus(lina.id, "salon-a", now))?.status, "CALLED");
    assert.equal(await Notification.countDocuments({ user: lina.id, type: "queue.called" }), 1);
    assert.equal((await myQueueStatus(sara.id, "salon-a", now))?.position, 1, "Sara avance d'une place");

    await leaveQueue(sara.id, "salon-a", now);
    assert.equal(await myQueueStatus(sara.id, "salon-a", now), null);
    await assert.rejects(joinQueue(sara.id, "salon-a", undefined, tunisToUtc(FUTURE_MONDAY, "19:50")), (e: AppError) => e.code === "QUEUE_CLOSED");
  });
});
