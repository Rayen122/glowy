import { addDays, tunisToday } from "@/core/domain/time";
import { Employee, idOf, Salon } from "@/infrastructure/db";
import { getAvailability } from "@/modules/booking";
import { searchSalons } from "@/modules/catalog";
import { getPlatformSettings } from "@/modules/platform";
import { matchesTime, parseMessage, pickService, SERVICES, type DayPart, type FaqTopic, type ServiceIntent } from "../domain/nlu";

/**
 * IA P3 : assistante de réservation. Comprend la demande, propose de vrais créneaux libres dans les salons
 * les mieux adaptés (ordre de la recommandation P1) ; la réservation n'est faite qu'après confirmation
 * explicite, par l'API de réservation habituelle (POST /api/bookings).
 */

export type ChatSlot = {
  salon: string;
  slug: string;
  serviceKey: string;
  serviceName: string;
  price: number;
  durationMin: number;
  date: string;
  time: string;
  employeeKey: string;
  employeeName: string;
  offPeak: boolean;
};

export type ChatReply =
  | { kind: "greeting" | "thanks" | "fallback" }
  | { kind: "faq"; topic: FaqTopic; hours?: { weekday: number; opensAt: string; closesAt: string }[]; salon?: string }
  | { kind: "clarify" }
  | { kind: "slots"; query: { service: ServiceIntent; date: string; part: DayPart | null; time: string | null; city: string | null }; slots: ChatSlot[]; text?: string }
  | { kind: "none"; query: { service: ServiceIntent; date: string; city: string | null }; text?: string }
  /** Réponse rédigée par l'IA (Gemini), dans la langue du client — derja tunisienne comprise */
  | { kind: "answer"; text: string };

const MAX_SALONS_CHECKED = 8;

/** Demande de créneaux comprise (par les règles ou par l'IA) */
export type SlotQuery = { service: ServiceIntent; date: string | null; part: DayPart | null; time: string | null; city: string | null };

/**
 * Vrais créneaux libres pour la prestation, dans les salons les mieux adaptés (ordre de la recommandation P1).
 * `onlySlug` : le client a nommé un salon ; `firstSlug` : salon de la page ouverte, essayé en premier ;
 * `request` : mots du client, pour choisir la bonne prestation de chaque salon (« coupe homme »).
 */
export async function findSlots(query: SlotQuery, opts: { userId?: string; now: Date; onlySlug?: string; firstSlug?: string; request?: string }): Promise<Extract<ChatReply, { kind: "slots" | "none" }>> {
  const intent = SERVICES[query.service];
  const wanted = { part: query.part, time: query.time };
  const firstDate = query.date ?? tunisToday(opts.now);
  // Sans date précise : aujourd'hui puis demain si plus rien d'adapté aujourd'hui
  const dates = query.date ? [query.date] : [firstDate, addDays(firstDate, 1)];

  const found = opts.onlySlug
    ? (await searchSalons({}, opts.userId, opts.now)).filter((s) => s.slug === opts.onlySlug)
    : await searchSalons({ city: query.city ?? undefined, category: intent.category }, opts.userId, opts.now);
  const ordered = opts.firstSlug ? [...found.filter((s) => s.slug === opts.firstSlug), ...found.filter((s) => s.slug !== opts.firstSlug)] : found;
  const docs = await Salon.find({ slug: { $in: ordered.slice(0, MAX_SALONS_CHECKED).map((s) => s.slug) } }, { slug: 1, name: 1, services: 1 }).lean();
  const employees = await Employee.find({ salon: { $in: docs.map((d) => d._id) } }, { salon: 1, key: 1, name: 1 }).lean();

  for (const date of dates) {
    const slots: ChatSlot[] = [];
    for (const view of ordered.slice(0, MAX_SALONS_CHECKED)) {
      if (slots.length >= 3) break;
      const doc = docs.find((d) => d.slug === view.slug);
      const service = doc && pickService(doc.services, query.service, opts.request);
      if (!doc || !service) continue;
      const { slots: free } = await getAvailability({ salonId: idOf(doc), date, durationMin: service.durationMin, withForecast: true });
      const slot = free.find((s) => s.employees.length > 0 && matchesTime(s.time, wanted));
      if (!slot) continue;
      const employeeKey = slot.employees[0];
      const employeeName = employees.find((e) => e.salon.equals(doc._id) && e.key === employeeKey)?.name ?? employeeKey;
      slots.push({ salon: doc.name, slug: doc.slug, serviceKey: service.key, serviceName: service.name, price: service.price, durationMin: service.durationMin, date, time: slot.time, employeeKey, employeeName, offPeak: slot.offPeak });
    }
    if (slots.length) return { kind: "slots", query: { service: query.service, date, part: query.part, time: query.time, city: query.city }, slots };
  }
  return { kind: "none", query: { service: query.service, date: firstDate, city: query.city } };
}

export async function knownCities() {
  const [settings, salonCities] = await Promise.all([getPlatformSettings(), Salon.distinct("city", { status: "ACTIVE" })]);
  return [...new Set([...settings.cities.map((c) => c.name), ...salonCities])].sort((a, b) => b.length - a.length);
}

/** Assistante sans IA externe : règles de compréhension et réponses préparées (repli quand Gemini n'est pas configuré) */
export async function ruleChat(input: { message: string; salonSlug?: string }, userId?: string, now = new Date()): Promise<ChatReply> {
  const parsed = parseMessage(input.message, now, await knownCities());

  if (parsed.intent === "greeting" || parsed.intent === "thanks") return { kind: parsed.intent };
  if (parsed.intent === "faq" && parsed.topic) {
    if (parsed.topic === "hours" && input.salonSlug) {
      const salon = await Salon.findOne({ slug: input.salonSlug, status: "ACTIVE" }, { name: 1, openingHours: 1 }).lean();
      if (salon) return { kind: "faq", topic: "hours", salon: salon.name, hours: salon.openingHours.filter((h) => h.opensAt && h.closesAt).map((h) => ({ weekday: h.weekday ?? 0, opensAt: h.opensAt!, closesAt: h.closesAt! })) };
    }
    return { kind: "faq", topic: parsed.topic };
  }
  if (parsed.intent !== "book") return { kind: "fallback" };
  if (!parsed.service) return { kind: "clarify" };
  return findSlots({ service: parsed.service, date: parsed.date, part: parsed.part, time: parsed.time, city: parsed.city }, { userId, now, firstSlug: input.salonSlug, request: input.message });
}
