import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Booking, Employee, Invoice } from "@/infrastructure/db";
import { checkout, checkoutInput, invoiceDetail, invoiceNumber, invoicePrefix, invoiceTotals, voidInvoice } from "@/modules/dashboard";
import { closeDb, makeSalon, makeUser, resetDb } from "./helpers";

/** Rendez-vous passé il y a une heure (createBooking refuse les créneaux passés) */
async function pastBooking(salonId: string, clientId: string, extra: Record<string, unknown> = {}) {
  const employee = await Employee.findOne({ salon: salonId }).orFail();
  const startsAt = new Date(Date.now() - 60 * 60_000);
  return Booking.create({
    client: clientId,
    salon: salonId,
    employee: employee._id,
    startsAt,
    endsAt: new Date(startsAt.getTime() + 30 * 60_000),
    status: "CONFIRMED",
    totalPrice: 20,
    items: [{ serviceKey: "coupe", name: "Coupe", price: 20, durationMin: 30 }],
    ...extra,
  });
}

describe("Caisse et factures (SAL-09)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("calcul : remise plafonnée au sous-total, acompte déduit du reste à payer", () => {
    assert.deepEqual(invoiceTotals([{ label: "Coupe", quantity: 2, unitPrice: 20 }], 5, 8), { subtotal: 40, discount: 5, total: 35, deposit: 8, due: 27 });
    assert.deepEqual(invoiceTotals([{ label: "Soin", quantity: 1, unitPrice: 10 }], 50, 30), { subtotal: 10, discount: 10, total: 0, deposit: 0, due: 0 });
    assert.equal(invoicePrefix("salon-yasmine"), "YAS");
    assert.equal(invoicePrefix("spa"), "SPA");
    assert.equal(invoiceNumber("YAS", 2026, 42), "YAS-2026-00042");
  });

  test("encaisser un rendez-vous le termine, numérote sans trou et refuse un second encaissement", async () => {
    const { salon, owner } = await makeSalon("salon-yasmine");
    const client = await makeUser();
    const booking = await pastBooking(salon.id, client.id, { payment: { amount: 4, status: "PAID" } });
    const input = checkoutInput.parse({ bookingId: booking._id.toString(), lines: [{ label: "Coupe", quantity: 1, unitPrice: 20 }], discount: 2, method: "CASH" });

    const first = await checkout(owner, input);
    assert.equal(first.number, `YAS-${new Date().getFullYear()}-00001`);
    assert.equal(first.due, 14, "20 − 2 de remise − 4 d'acompte");
    assert.equal((await Booking.findById(booking._id).orFail()).status, "COMPLETED");
    await assert.rejects(checkout(owner, input), (e: AppError) => e.code === "ALREADY_INVOICED");

    // Vente libre : numéro suivant
    const sale = await checkout(owner, checkoutInput.parse({ clientName: "Cliente de passage", lines: [{ label: "Shampoing", quantity: 2, unitPrice: 12.5 }], method: "CARD" }));
    assert.match(sale.number, /-00002$/);
    assert.equal(sale.due, 25);
  });

  test("la facture est visible par la cliente concernée seulement ; annulée, le rendez-vous peut être ré-encaissé", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const other = await makeSalon("salon-b");
    const client = await makeUser();
    const stranger = await makeUser();
    const booking = await pastBooking(salon.id, client.id);
    const input = checkoutInput.parse({ bookingId: booking._id.toString(), lines: [{ label: "Coupe", quantity: 1, unitPrice: 20 }], method: "D17" });
    const { id } = await checkout(owner, input);

    assert.equal((await invoiceDetail(client, id)).total, 20);
    await assert.rejects(invoiceDetail(stranger, id), (e: AppError) => e.status === 404);
    await assert.rejects(invoiceDetail(other.owner, id), (e: AppError) => e.status === 404);
    await assert.rejects(voidInvoice(other.owner, id, "Erreur"), (e: AppError) => e.status === 404);

    await voidInvoice(owner, id, "Erreur de saisie");
    assert.equal((await Invoice.findById(id).orFail()).status, "VOID");
    const again = await checkout(owner, input);
    assert.match(again.number, /-00002$/);
  });

  test("un rendez-vous à venir, annulé ou d'un autre salon ne s'encaisse pas", async () => {
    const { salon, owner } = await makeSalon("salon-a");
    const other = await makeSalon("salon-b");
    const client = await makeUser();
    const line = [{ label: "Coupe", quantity: 1, unitPrice: 20 }];
    const future = await pastBooking(salon.id, client.id, { startsAt: new Date(Date.now() + 3 * 86_400_000), endsAt: new Date(Date.now() + 3 * 86_400_000 + 1_800_000) });
    const cancelled = await pastBooking(salon.id, client.id, { status: "CANCELLED" });
    const parse = (bookingId: string) => checkoutInput.parse({ bookingId, lines: line, method: "CASH" });

    await assert.rejects(checkout(owner, parse(future._id.toString())), (e: AppError) => e.code === "FUTURE_BOOKING");
    await assert.rejects(checkout(owner, parse(cancelled._id.toString())), (e: AppError) => e.code === "NOT_COLLECTABLE");
    await assert.rejects(checkout(other.owner, parse(future._id.toString())), (e: AppError) => e.status === 404);
    assert.equal(checkoutInput.safeParse({ lines: line, method: "CASH" }).success, false, "vente libre sans nom refusée");
  });
});
