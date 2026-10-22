import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Notification, Salon } from "@/infrastructure/db";
import { assertOwnBranch, branchInput, createBranch, listBranches } from "@/modules/dashboard";
import { canManageSalon } from "@/modules/identity";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

describe("Plusieurs succursales (SAL-14)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("nouvelle succursale : prestations et horaires copiés, en attente de validation, pilotable par sa gérante seulement", async () => {
    const { owner } = await makeSalon("salon-a");
    const other = await makeSalon("salon-b");
    const admin = await makeUser("ADMIN");
    const { id } = await createBranch(owner, branchInput.parse({ name: "Salon A Sousse", city: "Sousse", address: "5 avenue Bourguiba" }));

    const branch = await Salon.findById(id).orFail().lean();
    assert.equal(branch.status, "PENDING");
    assert.deepEqual(branch.services.map((s) => s.key), ["coupe", "balayage"]);
    assert.equal(branch.openingHours.length, 7);
    assert.equal(await Notification.countDocuments({ user: admin.id, type: "salon.pending" }), 1, "le Super Admin est prévenu");

    const branches = await listBranches(owner);
    assert.deepEqual(branches.map((b) => [b.name, b.current]), [["Salon salon-a", true], ["Salon A Sousse", false]]);
    assert.equal(await canManageSalon(owner, id), true);
    assert.equal(await canManageSalon(other.owner, id), false);
    await assert.rejects(assertOwnBranch(other.owner, id), (e: AppError) => e.status === 403);
  });
});
