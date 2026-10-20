import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AuditLog, Booking, Employee, Notification, Salon } from "@/infrastructure/db";
import { commissionOn, commissionsReport, getPlatformSettings, platformSettingsInput, sendAnnouncement, updatePlatformSettings } from "@/modules/platform";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

describe("Paramètres de la plateforme, commissions et annonces (ADM-05, ADM-06, ADM-10)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("défauts, mise à jour section par section, français toujours disponible, réglage journalisé", async () => {
    const admin = await makeUser("ADMIN");
    assert.deepEqual((await getPlatformSettings()).locales, ["fr", "ar", "en"]);
    const updated = await updatePlatformSettings(admin.id, platformSettingsInput.parse({ locales: ["fr", "ar"], commissions: { gratuit: 12, pro: 6, premium: 2 } }));
    assert.deepEqual(updated.locales, ["fr", "ar"]);
    assert.equal(updated.commissions.gratuit, 12);
    assert.equal(updated.cities.length, 8, "les autres sections gardent leurs valeurs");
    assert.equal(platformSettingsInput.safeParse({ locales: ["en"] }).success, false);
    assert.equal(platformSettingsInput.safeParse({ cities: [{ name: "Tunis", active: true }, { name: "TUNIS", active: false }] }).success, false);
    assert.equal(await AuditLog.countDocuments({ action: "platform.settings" }), 1);
  });

  test("commission prélevée sur les acomptes payés en ligne, selon le plan du salon", async () => {
    assert.equal(commissionOn(30, 5), 1.5);
    const { salon } = await makeSalon("salon-a");
    await Salon.updateOne({ _id: salon.id }, { $set: { plan: "pro" } });
    const client = await makeUser();
    const employee = await Employee.findOne({ salon: salon.id }).orFail();
    const at = new Date();
    for (const amount of [20, 30]) {
      await Booking.create({ client: client.id, salon: salon.id, employee: employee._id, startsAt: at, endsAt: at, totalPrice: 100, deposit: amount, paymentMethod: "ONLINE", payment: { amount, status: "PAID" } });
    }
    const report = await commissionsReport(30);
    assert.equal(report.deposits, 50);
    assert.equal(report.rows[0].rate, 5);
    assert.equal(report.total, 2.5);
  });

  test("une annonce arrive en notification chez chaque destinataire actif de l'audience choisie", async () => {
    const admin = await makeUser("ADMIN");
    await makeUser();
    await makeUser();
    const manager = await makeUser("MANAGER");
    const { recipients } = await sendAnnouncement(admin.id, { title: "Nouveauté", body: "Les points salon arrivent bientôt.", audience: "CLIENTS", link: null });
    assert.equal(recipients, 2);
    assert.equal(await Notification.countDocuments({ type: "announcement" }), 2);
    assert.equal(await Notification.countDocuments({ type: "announcement", user: manager.id }), 0);
  });
});
