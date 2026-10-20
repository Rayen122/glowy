import { utcToTunis } from "@/core/domain/time";
import { Booking, Salon, User } from "@/infrastructure/db";
import { bookingReminder, type Message } from "../domain/messages";

const HOUR = 3_600_000;
const ACTIVE = ["PENDING", "CONFIRMED"] as const;

/**
 * RES-07 : rappels la veille (24 h avant) et 2 h avant le rendez-vous, par e-mail, SMS et notification.
 * Chaque rappel est « réservé » en base avant l'envoi (jamais deux fois, même si deux tâches tournent).
 * Pas de rappel de la veille pour un rendez-vous pris moins de 24 h avant (la confirmation suffit).
 */
export async function sendBookingReminders(deps: { notify: (userId: string, message: Message) => Promise<unknown>; email: (to: string, subject: string, text: string) => Promise<unknown>; sms: (phone: string, text: string) => Promise<unknown> }, now = new Date()) {
  const bookings = await Booking.find({ status: { $in: ACTIVE }, startsAt: { $gt: now, $lte: new Date(now.getTime() + 24 * HOUR) } }, { client: 1, salon: 1, startsAt: 1, createdAt: 1, reminders: 1 }).lean();
  let sent = 0;
  for (const b of bookings) {
    const soon = b.startsAt.getTime() - now.getTime() <= 2 * HOUR;
    const field = soon ? "reminders.hour" : "reminders.day";
    const leadNeeded = soon ? 3 * HOUR : 24 * HOUR;
    if (b.startsAt.getTime() - b.createdAt.getTime() < leadNeeded) continue;
    const claimed = await Booking.updateOne({ _id: b._id, status: { $in: ACTIVE }, [field]: null }, { $set: { [field]: now } });
    if (!claimed.modifiedCount) continue;

    const [client, salon] = await Promise.all([User.findById(b.client, { email: 1, phone: 1 }).lean(), Salon.findById(b.salon, { name: 1, address: 1 }).lean()]);
    if (!client || !salon) continue;
    const local = utcToTunis(b.startsAt);
    const date = new Intl.DateTimeFormat("fr-TN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${local.date}T12:00:00Z`));
    const message = bookingReminder(salon.name, date, local.time, soon ? "soon" : local.date === utcToTunis(now).date ? "today" : "tomorrow");
    await deps.notify(String(b.client), message);
    if (client.email) await deps.email(client.email, message.title, `${message.body}\nAdresse : ${salon.address}\nVotre espace : /compte/rendez-vous`);
    if (client.phone) await deps.sms(client.phone, `Glowy : ${message.title.toLowerCase()} — ${message.body}`);
    sent += 1;
  }
  return sent;
}
