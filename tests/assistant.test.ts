import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { tunisToUtc } from "@/core/domain/time";
import { chat, detectLang, matchesTime, parseMessage, pickService } from "@/modules/assistant";
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

  test("gros mots masqués avant tout traitement, la demande reste comprise", async () => {
    await makeSalon("salon-a");
    const greeting = await chat({ message: "aslema si zebi" }, undefined, MONDAY_9AM);
    assert.deepEqual([greeting.kind, greeting.masked], ["greeting", "aslema si ****"]);
    const rude = await chat({ message: "Ton salon c'est de la merde, je veux une coupe demain matin à Tunis" }, undefined, MONDAY_9AM);
    assert.equal(rude.kind, "slots", "la demande est traitée malgré l'insulte");
    assert.equal(rude.masked, "Ton salon c'est de la *****, je veux une coupe demain matin à Tunis");
    assert.equal((await chat({ message: "une coupe demain matin à Tunis" }, undefined, MONDAY_9AM)).masked, undefined, "message poli inchangé");
  });

  test("choix de la prestation du salon : public demandé, mots du client, puis la moins chère", () => {
    const menu = ["Coupe + soin hydratant 65", "Coupe femme + brushing 35", "Brushing 20", "Coupe enfant (-12 ans) 15", "Coupe + brushing 35", "Coupe homme 15", "Mariée : essai + jour J 320", "Chignon de mariée 120"].map((line) => {
      const price = Number(line.split(" ").at(-1));
      return { name: line.replace(/ \d+$/, ""), price, active: true };
    });
    assert.equal(pickService(menu, "coupe", "Je veux une coupe homme")?.name, "Coupe homme");
    assert.equal(pickService(menu, "coupe", "coupe femme demain matin")?.name, "Coupe femme + brushing");
    assert.equal(pickService(menu, "coupe", "nheb n9os cha3ri ghodwa")?.name, "Coupe + brushing", "sans public précis : ni enfant ni homme");
    assert.equal(pickService(menu, "brushing", "un brushing samedi")?.name, "Brushing");
    assert.equal(pickService(menu, "chignon", "أريد موعدا لتسريحة عروس")?.name, "Chignon de mariée");
    assert.equal(pickService([{ name: "Coupe femme", price: 30, active: true }], "coupe", "coupe homme"), undefined, "jamais une coupe femme pour un homme");
  });

  test("langue de la réponse : tounsi en arabizi ou en lettres arabes, arabe, français, anglais", () => {
    assert.equal(detectLang("aslema"), "tn_arabizi");
    assert.equal(detectLang("9addech el brushing fi Sousse ?"), "tn_arabizi");
    assert.equal(detectLang("Bonjour, nheb coupe ghodwa"), "tn_arabizi");
    assert.equal(detectLang("قداش المانيكير في المنزه؟"), "tn_arabe");
    assert.equal(detectLang("أريد حجز موعد غدا"), "ar");
    assert.equal(detectLang("Je voudrais une coupe le 15/01 à 14h30"), "fr");
    assert.equal(detectLang("What is the best salon for a haircut?"), "en");
  });
});
