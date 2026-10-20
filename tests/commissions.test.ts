import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { Booking, Employee } from "@/infrastructure/db";
import { employeeInput, salonStats } from "@/modules/dashboard";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

describe("Commissions des professionnels (SAL-13)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("commission = taux × chiffre d'affaires des rendez-vous terminés de la période", async () => {
    const { salon } = await makeSalon("salon-a");
    const client = await makeUser();
    const amira = await Employee.findOneAndUpdate({ salon: salon.id, key: "amira" }, { $set: { commissionRate: 30 } }, { returnDocument: "after" }).orFail();
    const at = new Date(Date.now() - 2 * 86_400_000);
    for (const [price, status] of [[100, "COMPLETED"], [50, "COMPLETED"], [80, "CANCELLED"]] as const) {
      await Booking.create({ client: client.id, salon: salon.id, employee: amira._id, startsAt: at, endsAt: at, status, totalPrice: price });
    }
    const stats = await salonStats(salon.id, 30);
    const row = stats.byEmployee.find((e) => e.name === "Amira");
    assert.deepEqual([row?.revenue, row?.rate, row?.commission], [150, 30, 45]);
    assert.equal(employeeInput.safeParse({ name: "Lina", title: "Coiffeuse", commissionRate: 95 }).success, false);
  });
});
