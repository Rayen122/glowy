import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import type { AppError } from "@/core/domain/errors";
import { Employee } from "@/infrastructure/db";
import { createBooking } from "@/modules/booking";
import { employeeDay } from "@/modules/dashboard";
import { canHandleBooking, ownEmployee } from "@/modules/identity";
import { afterVisit, closeDb, FUTURE_MONDAY, makeSalon, makeUser, resetDb } from "./helpers";

describe("Espace employé : seulement ses propres rendez-vous", () => {
  beforeEach(resetDb);
  after(closeDb);

  async function setup() {
    const { salon } = await makeSalon();
    const nourUser = await makeUser("EMPLOYEE");
    const nour = await Employee.findOneAndUpdate({ salon: salon.id, key: "nour" }, { $set: { user: nourUser.id } }, { returnDocument: "after" }).orFail().lean();
    const client = await makeUser();
    const book = (employee: string, time: string) =>
      createBooking(client.id, { salonSlug: "salon-test", serviceKeys: ["coupe"], employee, date: FUTURE_MONDAY, time, paymentMethod: "ONSITE" });
    return { salon, actor: { id: nourUser.id, role: "EMPLOYEE" as const }, nourId: nour._id.toString(), mine: await book("nour", "10:00"), colleague: await book("amira", "11:00") };
  }

  test("l'employée agit sur ses rendez-vous, jamais sur ceux d'une collègue", async () => {
    const { actor, nourId, mine, colleague } = await setup();
    assert.deepEqual(await ownEmployee(actor), { id: nourId, key: "nour", name: "Nour" });
    await afterVisit.setBookingStatus(mine.id, actor, "complete");
    await assert.rejects(afterVisit.setBookingStatus(colleague.id, actor, "complete"), (e: AppError) => e.status === 403);
    assert.equal(await canHandleBooking({ id: actor.id, role: "MANAGER" }, { salonId: "x", employeeId: nourId }), false);
  });

  test("« Ma journée » ne contient que ses rendez-vous", async () => {
    const { salon, nourId } = await setup();
    const day = await employeeDay(salon.id, nourId, new Date(`${FUTURE_MONDAY}T06:00:00Z`));
    assert.deepEqual(
      day.bookings.map((b) => b.time),
      ["10:00"]
    );
  });
});
