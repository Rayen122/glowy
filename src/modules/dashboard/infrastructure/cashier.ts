import type { Actor } from "@/core/domain/actor";
import type { CashMethod } from "@/core/domain/enums";
import { badRequest, conflict, forbidden, notFound } from "@/core/domain/errors";
import { tunisDayRange, tunisToday, utcToTunis } from "@/core/domain/time";
import { Booking, Counter, Employee, idOf, Invoice, objectId, Salon, User } from "@/infrastructure/db";
import { setBookingStatus } from "@/modules/booking";
import type { CheckoutInput } from "../application/schemas";
import { invoiceNumber, invoicePrefix, invoiceTotals } from "../domain/invoice";
import { currentSalonId } from "./current-salon";

/** SAL-09 : caisse du salon — encaissement des rendez-vous, ventes libres, factures imprimables */

const TO_COLLECT = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000;
const paidDeposit = (b: { payment?: { status?: string | null; amount?: number | null } | null }) => (b.payment?.status === "PAID" ? (b.payment.amount ?? 0) : 0);

/** Journée de caisse : rendez-vous à encaisser, factures émises, totaux par moyen de paiement */
export async function cashierDay(salonId: string, date: string) {
  const salon = objectId(salonId)!;
  const { start, end } = tunisDayRange(date);
  const [bookings, invoices] = await Promise.all([
    Booking.find({ salon, startsAt: { $gte: start, $lt: end }, status: { $in: TO_COLLECT } }).sort({ startsAt: 1 }).lean(),
    Invoice.find({ salon, createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }).lean(),
  ]);
  const invoiced = new Set((await Invoice.find({ booking: { $in: bookings.map((b) => b._id) }, status: "PAID" }, { booking: 1 }).lean()).map((i) => String(i.booking)));
  const open = bookings.filter((b) => !invoiced.has(idOf(b)));
  const [clients, employees] = await Promise.all([
    User.find({ _id: { $in: open.map((b) => b.client) } }, { firstName: 1, lastName: 1 }).lean(),
    Employee.find({ salon }, { name: 1 }).lean(),
  ]);
  const paid = invoices.filter((i) => i.status === "PAID");
  const byMethod = Object.fromEntries((["CASH", "CARD", "D17", "CHEQUE"] as const).map((m) => [m, paid.filter((i) => i.method === m).reduce((a, i) => a + i.due, 0)])) as Record<CashMethod, number>;

  return {
    date,
    toCollect: open.map((b) => {
      const client = clients.find((c) => c._id.equals(b.client));
      return {
        id: idOf(b),
        time: utcToTunis(b.startsAt).time,
        status: b.status,
        client: client ? `${client.firstName} ${client.lastName}`.trim() : "",
        employee: employees.find((e) => e._id.equals(b.employee))?.name ?? "",
        items: b.items.map((i) => ({ label: i.name ?? "", unitPrice: i.price ?? 0 })),
        total: b.totalPrice,
        deposit: paidDeposit(b),
      };
    }),
    invoices: invoices.map((i) => ({
      id: idOf(i),
      number: i.number,
      client: i.clientName,
      time: utcToTunis(i.createdAt).time,
      total: i.total,
      due: i.due,
      deposit: i.deposit,
      method: i.method as CashMethod,
      status: i.status as "PAID" | "VOID",
    })),
    totals: {
      collected: paid.reduce((a, i) => a + i.due, 0),
      deposits: paid.reduce((a, i) => a + i.deposit, 0),
      revenue: paid.reduce((a, i) => a + i.total, 0),
      count: paid.length,
      byMethod,
    },
  };
}

export type CashierDay = Awaited<ReturnType<typeof cashierDay>>;

async function nextInvoiceNumber(salonId: string, slug: string, now: Date) {
  const year = Number(utcToTunis(now).date.slice(0, 4));
  const counter = await Counter.findOneAndUpdate({ _id: `invoice:${salonId}:${year}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" }).lean();
  return invoiceNumber(invoicePrefix(slug), year, counter!.seq);
}

/** Encaisse un rendez-vous (le passe à « terminé » s'il ne l'est pas : points de fidélité, avis) ou une vente libre */
export async function checkout(actor: Actor, input: CheckoutInput, now = new Date()) {
  const salonId = await currentSalonId(actor);
  const salon = await Salon.findById(salonId, { slug: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");

  let client: { id: string | null; name: string; email: string | null; phone: string | null } = { id: null, name: input.clientName ?? "", email: null, phone: null };
  let deposit = 0;
  if (input.bookingId) {
    const booking = await Booking.findOne({ _id: objectId(input.bookingId), salon: salon._id }).lean();
    if (!booking) throw notFound("Rendez-vous introuvable dans ce salon.");
    if (!(TO_COLLECT as readonly string[]).includes(booking.status)) throw conflict("NOT_COLLECTABLE", "Ce rendez-vous ne peut pas être encaissé.");
    if (utcToTunis(booking.startsAt).date > tunisToday(now)) throw badRequest("FUTURE_BOOKING", "Un rendez-vous à venir ne peut pas encore être encaissé.");
    if (await Invoice.exists({ booking: booking._id, status: "PAID" })) throw conflict("ALREADY_INVOICED", "Ce rendez-vous est déjà encaissé.");
    if (booking.status !== "COMPLETED") await setBookingStatus(input.bookingId, actor, "complete");
    const user = await User.findById(booking.client, { firstName: 1, lastName: 1, email: 1, phone: 1 }).lean();
    client = { id: String(booking.client), name: user ? `${user.firstName} ${user.lastName}`.trim() : "", email: user?.email ?? null, phone: user?.phone ?? null };
    deposit = paidDeposit(booking);
  }

  const totals = invoiceTotals(input.lines, input.discount, deposit);
  try {
    const invoice = await Invoice.create({
      salon: salon._id,
      number: await nextInvoiceNumber(salonId, salon.slug, now),
      booking: input.bookingId ? objectId(input.bookingId) : undefined,
      client: client.id ? objectId(client.id) : undefined,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      lines: input.lines,
      ...totals,
      method: input.method,
      issuedBy: objectId(actor.id)!,
    });
    return { id: idOf(invoice), number: invoice.number, due: invoice.due };
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict("ALREADY_INVOICED", "Ce rendez-vous est déjà encaissé.");
    throw error;
  }
}

/** Facture lisible par l'équipe du salon, la cliente concernée ou le Super Admin */
export async function invoiceDetail(actor: Actor, invoiceId: string) {
  const invoice = await Invoice.findById(objectId(invoiceId)).lean();
  if (!invoice) throw notFound("Facture introuvable.");
  if (actor.role === "CLIENT") {
    if (!invoice.client?.equals(actor.id)) throw notFound("Facture introuvable.");
  } else if (actor.role !== "ADMIN" && (await currentSalonId(actor)) !== String(invoice.salon)) {
    throw notFound("Facture introuvable.");
  }
  const [salon, issuer] = await Promise.all([
    Salon.findById(invoice.salon, { name: 1, address: 1, city: 1, phone: 1 }).lean(),
    User.findById(invoice.issuedBy, { firstName: 1 }).lean(),
  ]);
  return {
    id: idOf(invoice),
    number: invoice.number,
    status: invoice.status as "PAID" | "VOID",
    issuedAt: invoice.createdAt,
    issuedBy: issuer?.firstName ?? null,
    voidedAt: invoice.voidedAt ?? null,
    voidReason: invoice.voidReason ?? null,
    salon: { name: salon?.name ?? "", address: salon?.address ?? "", city: salon?.city ?? "", phone: salon?.phone ?? null },
    client: { name: invoice.clientName, email: invoice.clientEmail ?? null, phone: invoice.clientPhone ?? null },
    bookingId: invoice.booking ? String(invoice.booking) : null,
    lines: invoice.lines.map((l) => ({ label: l.label ?? "", quantity: l.quantity ?? 1, unitPrice: l.unitPrice ?? 0 })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    deposit: invoice.deposit,
    total: invoice.total,
    due: invoice.due,
    method: invoice.method as CashMethod,
  };
}

export type InvoiceDetail = Awaited<ReturnType<typeof invoiceDetail>>;

/** Annulation (avoir) par le gérant : la facture reste au journal, le rendez-vous peut être ré-encaissé */
export async function voidInvoice(actor: Actor, invoiceId: string, reason: string, now = new Date()) {
  if (actor.role !== "MANAGER" && actor.role !== "ADMIN") throw forbidden("Seul le gérant peut annuler une facture.");
  const salon = objectId(await currentSalonId(actor))!;
  const updated = await Invoice.findOneAndUpdate(
    { _id: objectId(invoiceId), salon, status: "PAID" },
    { $set: { status: "VOID", voidedAt: now, voidReason: reason } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) throw notFound("Facture introuvable ou déjà annulée.");
  return { id: invoiceId, status: updated.status };
}
