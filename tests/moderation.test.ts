import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { createBooking } from "@/modules/booking";
import { assertSafeImage, isProfane, maskProfanity } from "@/modules/moderation";
import { actOnReview, createReview } from "@/modules/reviews";
import { afterVisit, closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

const mask = (text: string, extra?: string[]) => maskProfanity(text, extra).text;

describe("IA de modération : gros mots masqués (tounsi, arabizi, arabe, français, anglais)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("derja tunisienne en arabizi, majuscules et lettres étirées", () => {
    assert.equal(mask("Zebi 3la had salon"), "**** 3la had salon");
    assert.equal(mask("9A7BA"), "*****");
    assert.equal(mask("ya zebiiiiii"), "ya *********");
    assert.equal(mask("nikomek w nik omek"), "******* w *** omek");
    assert.ok(isProfane("3asba") && isProfane("ta7an") && isProfane("miboun"));
  });

  test("arabe : signes diacritiques et préfixes / suffixes collés", () => {
    assert.equal(mask("يا قحبة"), "يا ****");
    assert.equal(mask("ياقحبة"), "******");
    assert.ok(isProfane("قَحْبَة") && isProfane("زبي") && isProfane("شرموطتك"));
  });

  test("français et anglais, accents et « leet »", () => {
    assert.equal(mask("Quel connard, enculé !"), "Quel *******, ****** !");
    assert.ok(isProfane("sh1t") && isProfane("fucking") && isProfane("$alope"));
  });

  test("aucun faux positif sur les mots courants", () => {
    for (const text of ["Très bon conseil, coupe parfaite", "Salopette et cône glacé", "زبدة وكسكسي", "Merci Zaki", "زكي", "Nikon, Nike", "خدمة ممتازة، شكرا"]) {
      assert.equal(mask(text), text, text);
    }
  });

  test("mots repérés par l'IA : masqués uniquement en mots entiers", () => {
    assert.equal(mask("Service de mer*de, conseil nul", ["mer*de", "con"]), "Service de ******, conseil nul");
    assert.equal(mask("Rien à signaler", []), "Rien à signaler");
  });

  test("avis et réponse du salon publiés avec les gros mots masqués", async () => {
    const { owner } = await makeSalon();
    const client = await makeUser();
    const booking = await createBooking(client.id, { salonSlug: "salon-test", serviceKeys: ["coupe"], employee: "amira", date: FUTURE_MONDAY, time: "09:00", paymentMethod: "ONSITE" });
    await afterVisit.setBookingStatus(booking.id, { id: owner.id, role: "MANAGER" }, "complete");
    const review = await createReview({ id: client.id, role: "CLIENT" }, { bookingId: booking.id, rating: 1, text: "Coiffeuse 9a7ba, ma n3awedch", lang: "fr" });
    assert.equal(review.text, "Coiffeuse *****, ma n3awedch");
    const replied = await actOnReview({ id: owner.id, role: "MANAGER" }, review.id, { action: "reply", reply: "Merci, mais zebi" });
    assert.ok("reply" in replied && replied.reply === "Merci, mais ****");
  });

  test("photos : sans clé Gemini (tests), aucune vérification ni appel réseau", async () => {
    await assert.doesNotReject(assertSafeImage(new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg"));
  });
});
