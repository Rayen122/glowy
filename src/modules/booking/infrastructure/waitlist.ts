import { badRequest, conflict, notFound } from "@/core/domain/errors";
import { tunisToday, utcToTunis } from "@/core/domain/time";
import { Booking, idOf, isDuplicateKey, objectId, Salon, WaitlistEntry } from "@/infrastructure/db";

/**
 * RES-09 (bonus) : liste d'attente d'un jour complet. Quand un rendez-vous de ce jour est annulé, les clientes
 * inscrites (les plus anciennes d'abord) sont prévenues si un créneau compatible avec leurs prestations s'est libéré.
 */

type Notifier = (userId: string, message: { type: string; title: string; body: string; link?: string }) => Promise<unknown>;
type FreeSlots = (salonId: string, date: string, durationMin: number) => Promise<string[]>;

const MAX_NOTIFIED = 5;

export async function joinWaitlist(clientId: string, slug: string, input: { date: string; serviceKeys: string[] }, now = new Date()) {
  const salon = await Salon.findOne({ slug, status: "ACTIVE" }, { services: 1 }).lean();
  if (!salon) throw notFound("Salon introuvable.");
  if (input.date < tunisToday(now)) throw badRequest("PAST_DATE", "Cette date est déjà passée.");
  const known = new Set(salon.services.filter((s) => s.active).map((s) => s.key));
  if (!input.serviceKeys.length || input.serviceKeys.some((k) => !known.has(k))) throw badRequest("UNKNOWN_SERVICE", "Prestation inconnue pour ce salon.");
  try {
    const entry = await WaitlistEntry.create({ salon: salon._id, client: objectId(clientId)!, date: input.date, serviceKeys: input.serviceKeys });
    return { id: idOf(entry), date: input.date };
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict("ALREADY_WAITING", "Vous êtes déjà sur la liste d'attente de ce jour.");
    throw error;
  }
}

export async function leaveWaitlist(clientId: string, entryId: string) {
  const updated = await WaitlistEntry.findOneAndUpdate({ _id: objectId(entryId), client: objectId(clientId), status: { $in: ["ACTIVE", "NOTIFIED"] } }, { $set: { status: "CANCELLED" } }).lean();
  if (!updated) throw notFound("Inscription introuvable.");
  return { id: entryId };
}

/** Inscriptions de la cliente encore utiles (jour non passé) */
export async function myWaitlist(clientId: string, now = new Date()) {
  const entries = await WaitlistEntry.find({ client: objectId(clientId), status: { $in: ["ACTIVE", "NOTIFIED"] }, date: { $gte: tunisToday(now) } }).sort({ date: 1 }).lean();
  const salons = await Salon.find({ _id: { $in: entries.map((e) => e.salon) } }, { name: 1, slug: 1, services: 1 }).lean();
  return entries.map((e) => {
    const salon = salons.find((s) => s._id.equals(e.salon));
    return {
      id: idOf(e),
      date: e.date,
      status: e.status as "ACTIVE" | "NOTIFIED",
      salon: { name: salon?.name ?? "", slug: salon?.slug ?? "" },
      services: e.serviceKeys.map((k) => salon?.services.find((s) => s.key === k)?.name ?? k),
      serviceKeys: e.serviceKeys,
    };
  });
}

/** Abonné à booking.cancelled : prévient les inscrites du jour si un créneau adapté s'est libéré */
export async function notifyWaitlist(bookingId: string, deps: { notify: Notifier; freeSlots: FreeSlots }) {
  const booking = await Booking.findById(objectId(bookingId), { salon: 1, startsAt: 1 }).lean();
  if (!booking) return 0;
  const date = utcToTunis(booking.startsAt).date;
  const [salon, entries] = await Promise.all([
    Salon.findById(booking.salon, { name: 1, slug: 1, services: 1 }).lean(),
    WaitlistEntry.find({ salon: booking.salon, date, status: "ACTIVE" }).sort({ createdAt: 1 }).limit(20).lean(),
  ]);
  if (!salon) return 0;
  let notified = 0;
  for (const entry of entries) {
    if (notified >= MAX_NOTIFIED) break;
    const services = salon.services.filter((s) => entry.serviceKeys.includes(s.key));
    const duration = services.reduce((a, s) => a + s.durationMin, 0) || 30;
    const free = await deps.freeSlots(String(salon._id), date, duration);
    if (!free.length) continue;
    const claimed = await WaitlistEntry.updateOne({ _id: entry._id, status: "ACTIVE" }, { $set: { status: "NOTIFIED", notifiedAt: new Date() } });
    if (!claimed.modifiedCount) continue;
    const day = new Intl.DateTimeFormat("fr-TN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
    await deps.notify(String(entry.client), {
      type: "waitlist.slot",
      title: "Un créneau s'est libéré",
      body: `${salon.name}, ${day} : ${free.slice(0, 3).join(", ")}. Réservez vite, premier arrivé, premier servi.`,
      link: `/salons/${salon.slug}/reserver?service=${entry.serviceKeys[0]}&date=${date}`,
    });
    notified += 1;
  }
  return notified;
}

/** Planificateur : inscriptions dont le jour est passé */
export async function expireWaitlist(now = new Date()) {
  return (await WaitlistEntry.updateMany({ status: { $in: ["ACTIVE", "NOTIFIED"] }, date: { $lt: tunisToday(now) } }, { $set: { status: "EXPIRED" } })).modifiedCount;
}
