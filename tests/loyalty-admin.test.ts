import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { tunisToday } from "@/core/domain/time";
import { AuditLog } from "@/infrastructure/db";
import { award, createCampaign, listCampaigns, listPointRules, pointCampaignInput, pointRuleInput, setCampaignActive, updatePointRule } from "@/modules/loyalty";
import { closeDb, makeUser, resetDb } from "./helpers";

describe("Barème de fidélité et campagnes « double points » (ADM-09)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("le barème modifié s'applique aussitôt, plafond quotidien compris, et laisse une trace au journal", async () => {
    const admin = await makeUser("ADMIN");
    const client = await makeUser();
    await updatePointRule(admin.id, "SHARE", pointRuleInput.parse({ points: 8, active: true, monthlyCap: null, dailyCap: 2 }));
    assert.deepEqual([await award(client.id, "SHARE"), await award(client.id, "SHARE"), await award(client.id, "SHARE")], [8, 8, 0]);
    await updatePointRule(admin.id, "SHARE", pointRuleInput.parse({ points: 8, active: false, monthlyCap: null, dailyCap: null }));
    assert.equal(await award(client.id, "SHARE"), 0, "action désactivée");
    assert.equal((await listPointRules()).find((r) => r.reason === "SHARE")?.active, false);
    assert.equal(await AuditLog.countDocuments({ action: "loyalty.rule" }), 2);
  });

  test("une campagne multiplie les gains des actions choisies pendant sa période, jamais les pénalités", async () => {
    const admin = await makeUser("ADMIN");
    const client = await makeUser();
    const today = tunisToday();
    const { id } = await createCampaign(admin.id, pointCampaignInput.parse({ label: "Double points", multiplier: 2, startsOn: today, endsOn: today, reasons: ["OFF_PEAK", "NO_SHOW"] }));
    assert.equal((await listCampaigns()).find((c) => c.id === id)?.status, "running");

    assert.equal(await award(client.id, "OFF_PEAK"), 20);
    assert.equal(await award(client.id, "EARLY_BOOKING"), 5, "action hors campagne");
    assert.equal(await award(client.id, "NO_SHOW"), -20, "pénalité non multipliée");

    await setCampaignActive(admin.id, id, false);
    assert.equal(await award(client.id, "OFF_PEAK"), 10, "campagne en pause");
    assert.equal(pointCampaignInput.safeParse({ label: "Trop", multiplier: 10, startsOn: today, endsOn: today }).success, false);
  });
});
