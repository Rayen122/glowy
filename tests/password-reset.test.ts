import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AccountToken, OutboxMessage, User } from "@/infrastructure/db";
import { authenticate, hashPassword, requestPasswordReset, resetPassword } from "@/modules/identity";
import { emailHtml } from "@/modules/notifications/infrastructure/smtp-mailer";
import { closeDb, makeUser, resetDb } from "./helpers";

const ORIGIN = "https://glowy.example";

async function lastResetLink(email: string) {
  const message = await OutboxMessage.findOne({ to: email }).sort({ createdAt: -1 }).orFail().lean();
  const link = message.text.match(/https:\/\/\S+/)![0];
  return { message, link, token: new URL(link).searchParams.get("token")! };
}

describe("Mot de passe oublié (AUTH-05)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("lien envoyé, nouveau mot de passe enregistré, lien à usage unique", async () => {
    const client = await makeUser();
    const { email } = await User.findById(client.id).orFail().lean();
    await User.updateOne({ _id: client.id }, { $set: { passwordHash: await hashPassword("AncienMotDePasse1") } });

    assert.deepEqual(await requestPasswordReset(email, ORIGIN), { sent: true });
    const { message, link, token } = await lastResetLink(email);
    assert.equal(message.delivery, "simulated", "pas de SMTP pendant les tests");
    assert.ok(link.startsWith(`${ORIGIN}/reinitialiser?token=`), "le lien pointe vers l'adresse publique du site");

    assert.deepEqual(await resetPassword(token, "NouveauMotDePasse1"), { reset: true });
    assert.equal((await authenticate(email, "NouveauMotDePasse1")).ok, true);
    assert.equal((await authenticate(email, "AncienMotDePasse1")).ok, false);
    await assert.rejects(resetPassword(token, "EncoreUnAutre1"), { code: "INVALID_TOKEN" });
  });

  test("lien expiré refusé ; adresse inconnue : même réponse, aucun e-mail", async () => {
    const client = await makeUser();
    const { email } = await User.findById(client.id).orFail().lean();
    await requestPasswordReset(email, ORIGIN);
    const { token } = await lastResetLink(email);
    await AccountToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(resetPassword(token, "NouveauMotDePasse1"), { code: "INVALID_TOKEN" });

    assert.deepEqual(await requestPasswordReset("personne@test.tn", ORIGIN), { sent: true });
    assert.equal(await OutboxMessage.countDocuments({ to: "personne@test.tn" }), 0);
  });

  test("au plus un e-mail par minute pour le même compte", async () => {
    const client = await makeUser();
    const { email } = await User.findById(client.id).orFail().lean();
    await requestPasswordReset(email, ORIGIN);
    await requestPasswordReset(email, ORIGIN);
    assert.equal(await OutboxMessage.countDocuments({ to: email }), 1);
  });

  test("version HTML de l'e-mail : texte échappé, lien final transformé en bouton", () => {
    const html = emailHtml("Objet", "Bonjour <b>Sarra</b>,\n\nOuvrez ce lien :\nhttps://glowy.example/reinitialiser?token=abc&x=1");
    assert.ok(html.includes("Bonjour &lt;b&gt;Sarra&lt;/b&gt;"));
    assert.ok(html.includes('href="https://glowy.example/reinitialiser?token=abc&amp;x=1"'));
    assert.ok(html.includes("Ouvrir le lien"));
  });
});
