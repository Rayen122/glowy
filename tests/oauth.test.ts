import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { User } from "@/infrastructure/db";
import { oauthSignIn } from "@/modules/identity";
import { closeDb, makeUser, resetDb } from "./helpers";

const profile = (email: string, emailVerified = true) => ({ email, emailVerified, firstName: "Lina", lastName: "Ben Salem", locale: "fr" as const });

describe("Connexion avec Google (AUTH-08)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("crée un compte cliente vérifié, ou relie un compte existant ; refuse une adresse non vérifiée ou un compte bloqué", async () => {
    assert.equal(await oauthSignIn(profile("pirate@gmail.com", false)), null, "adresse non certifiée par Google");

    const created = await oauthSignIn(profile("Lina@Gmail.com"));
    assert.equal(created?.email, "lina@gmail.com");
    assert.equal(created?.role, "CLIENT");
    assert.ok((await User.findById(created!.id).orFail()).emailVerified, "adresse vérifiée");
    assert.equal((await oauthSignIn(profile("lina@gmail.com")))?.id, created?.id, "même compte à la connexion suivante");

    const existing = await makeUser();
    const email = (await User.findById(existing.id).orFail()).email;
    assert.equal((await oauthSignIn(profile(email)))?.id, existing.id, "compte existant relié");
    await User.updateOne({ _id: existing.id }, { $set: { status: "BLOCKED" } });
    assert.equal(await oauthSignIn(profile(email)), null);
  });
});
