import "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { AppError } from "@/core/domain/errors";
import { Notification, User } from "@/infrastructure/db";
import { myTickets, openTicket, replyToTicket, setTicketStatus, supportQueue, ticketThread } from "@/modules/support";
import { closeDb, makeUser, resetDb } from "./helpers";

describe("Tickets de support (AVI-07)", () => {
  beforeEach(resetDb);
  after(closeDb);

  test("conversation entre la cliente et le support, notifications, accès réservé, fermeture", async () => {
    const admin = await makeUser("ADMIN");
    const client = await makeUser();
    const other = await makeUser();
    const { id } = await openTicket(client, null, { subject: "Acompte non remboursé", category: "payment", text: "Bonjour, mon acompte n'a pas été remboursé après annulation." });
    assert.equal(await Notification.countDocuments({ user: admin.id, type: "support.new" }), 1);

    const answered = await replyToTicket(admin, id, "Bonjour, c'est corrigé : remboursement sous 48 h.");
    assert.equal(answered.status, "ANSWERED");
    assert.equal(await Notification.countDocuments({ user: client.id, type: "support.reply" }), 1);
    await assert.rejects(ticketThread(other, id), (e: AppError) => e.status === 404);

    await setTicketStatus(client, id, "CLOSED");
    await assert.rejects(replyToTicket(client, id, "Merci !"), (e: AppError) => e.code === "TICKET_CLOSED");
    assert.equal((await myTickets(client))[0].status, "CLOSED");
    assert.equal((await supportQueue("open")).length, 0);
  });

  test("support prioritaire pour le niveau Platine, en tête de file", async () => {
    const regular = await makeUser();
    const platinum = await makeUser();
    await User.updateOne({ _id: platinum.id }, { $set: { "loyalty.lifetime": 1500 } });
    await openTicket(regular, null, { subject: "Question sur mon compte", category: "account", text: "Comment changer mon numéro de téléphone ?" });
    await openTicket(platinum, null, { subject: "Problème de réservation", category: "booking", text: "Mon rendez-vous de demain n'apparaît plus." });
    const queue = await supportQueue();
    assert.deepEqual(queue.map((q) => q.priority), [true, false]);
  });
});
