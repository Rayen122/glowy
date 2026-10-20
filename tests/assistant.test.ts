import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { tunisToUtc } from "@/core/domain/time";
import { chat, matchesTime, parseMessage } from "@/modules/assistant";
import { closeDb, FUTURE_MONDAY, makeSalon, resetDb } from "./helpers";

const MONDAY_9AM = tunisToUtc(FUTURE_MONDAY, "09:00");
const CITIES = ["Tunis", "La Marsa", "El Menzah"];

describe("IA P3 : assistante de réservation", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("comprend prestation, jour, moment, heure et ville en français, anglais et arabe", () => {
    const fr = parseMessage("Je voudrais une coupe demain matin à La Marsa", MONDAY_9AM, CITIES);
    assert.deepEqual([fr.intent, fr.service, fr.date, fr.part, fr.city], ["book", "coupe", "2030-01-08", "morning", "La Marsa"]);
    const en = parseMessage("Manicure on Saturday at 3pm", MONDAY_9AM, CITIES);
    assert.deepEqual([en.service, en.date, en.time], ["ongles", "2030-01-12", "15:00"]);
    const ar = parseMessage("نحب مساج نهار الخميس العشية", MONDAY_9AM, CITIES);
    assert.deepEqual([ar.service, ar.date, ar.part], ["massage", "2030-01-10", "afternoon"]);
    assert.equal(parseMessage("Comment annuler mon rendez-vous ?", MONDAY_9AM, CITIES).topic, "cancel");
    assert.equal(parseMessage("Bonjour", MONDAY_9AM, CITIES).intent, "greeting");
    assert.equal(parseMessage("blablabla", MONDAY_9AM, CITIES).intent, "unknown");
    assert.equal(parseMessage("rdv le 15/01 à 14h30", MONDAY_9AM, CITIES).date, "2030-01-15");
  });

  test("filtre les créneaux selon l'heure ou le moment demandés", () => {
    assert.equal(matchesTime("10:30", { part: "morning", time: null }), true);
    assert.equal(matchesTime("14:00", { part: "morning", time: null }), false);
    assert.equal(matchesTime("15:30", { part: null, time: "15:00" }), true);
    assert.equal(matchesTime("17:30", { part: null, time: "15:00" }), false);
  });

  test("propose de vrais créneaux libres, sinon une question ou le repli", async () => {
    await makeSalon("salon-a");
    const reply = await chat({ message: "une coupe demain matin à Tunis" }, undefined, MONDAY_9AM);
    assert.equal(reply.kind, "slots");
    if (reply.kind === "slots") {
      assert.equal(reply.slots[0].slug, "salon-a");
      assert.equal(reply.slots[0].serviceKey, "coupe");
      assert.equal(reply.slots[0].date, "2030-01-08");
      assert.ok(reply.slots[0].time < "12:00", "le matin");
    }
    assert.equal((await chat({ message: "je veux réserver demain" }, undefined, MONDAY_9AM)).kind, "clarify");
    assert.equal((await chat({ message: "manucure demain" }, undefined, MONDAY_9AM)).kind, "none", "aucun salon d'ongles");
    assert.equal((await chat({ message: "quels sont vos horaires ?", salonSlug: "salon-a" }, undefined, MONDAY_9AM)).kind, "faq");
    assert.equal((await chat({ message: "xyz" }, undefined, MONDAY_9AM)).kind, "fallback");
  });
});
