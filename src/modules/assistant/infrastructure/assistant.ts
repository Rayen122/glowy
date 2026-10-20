import { addDays, tunisToday } from "@/core/domain/time";
import { Employee, idOf, Salon } from "@/infrastructure/db";
import { getAvailability } from "@/modules/booking";
import { searchSalons } from "@/modules/catalog";
import { getPlatformSettings } from "@/modules/platform";
import { matchesTime, parseMessage, SERVICES, type DayPart, type FaqTopic, type ServiceIntent } from "../domain/nlu";

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
  | { kind: "slots"; query: { service: ServiceIntent; date: string; part: DayPart | null; time: string | null; city: string | null }; slots: ChatSlot[] }
  | { kind: "none"; query: { service: ServiceIntent; date: string; city: string | null } };

const MAX_SALONS_CHECKED = 8;

export async function chat(input: { message: string; salonSlug?: string }, userId?: string, now = new Date()): Promise<ChatReply> {
  const [settings, salonCities] = await Promise.all([getPlatformSettings(), Salon.distinct("city", { status: "ACTIVE" })]);
  const cities = [...new Set([...settings.cities.map((c) => c.name), ...salonCities])].sort((a, b) => b.length - a.length);
  const parsed = parseMessage(input.message, now, cities);

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

  const intent = SERVICES[parsed.service];
  const wanted = { part: parsed.part, time: parsed.time };
  const firstDate = parsed.date ?? tunisToday(now);
  // Sans date précise : aujourd'hui puis demain si plus rien d'adapté aujourd'hui
  const dates = parsed.date ? [parsed.date] : [firstDate, addDays(firstDate, 1)];

  const found = await searchSalons({ city: parsed.city ?? undefined, category: intent.category }, userId, now);
  const ordered = input.salonSlug ? [...found.filter((s) => s.slug === input.salonSlug), ...found.filter((s) => s.slug !== input.salonSlug)] : found;
  const docs = await Salon.find({ slug: { $in: ordered.slice(0, MAX_SALONS_CHECKED).map((s) => s.slug) } }, { slug: 1, name: 1, services: 1 }).lean();
  const employees = await Employee.find({ salon: { $in: docs.map((d) => d._id) } }, { salon: 1, key: 1, name: 1 }).lean();

  for (const date of dates) {
    const slots: ChatSlot[] = [];
    for (const view of ordered.slice(0, MAX_SALONS_CHECKED)) {
      if (slots.length >= 3) break;
      const doc = docs.find((d) => d.slug === view.slug);
      const service = doc?.services.find((s) => s.active && intent.search.some((term) => s.name.toLowerCase().includes(term)));
      if (!doc || !service) continue;
      const { slots: free } = await getAvailability({ salonId: idOf(doc), date, durationMin: service.durationMin, withForecast: true });
      const slot = free.find((s) => s.employees.length > 0 && matchesTime(s.time, wanted));
      if (!slot) continue;
      const employeeKey = slot.employees[0];
      const employeeName = employees.find((e) => e.salon.equals(doc._id) && e.key === employeeKey)?.name ?? employeeKey;
      slots.push({ salon: doc.name, slug: doc.slug, serviceKey: service.key, serviceName: service.name, price: service.price, durationMin: service.durationMin, date, time: slot.time, employeeKey, employeeName, offPeak: slot.offPeak });
    }
    if (slots.length) return { kind: "slots", query: { service: parsed.service, date, part: parsed.part, time: parsed.time, city: parsed.city }, slots };
  }
  return { kind: "none", query: { service: parsed.service, date: firstDate, city: parsed.city } };
}
