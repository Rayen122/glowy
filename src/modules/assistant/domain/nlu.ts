import { addDays, tunisToday, utcToTunis } from "@/core/domain/time";

/**
 * IA P3 — compréhension des messages de l'assistante (fonctions pures, testées), sans service externe.
 * Français, arabe (dont darija courante) et anglais : prestation, date, moment de la journée, heure, ville,
 * questions fréquentes. Ce qui n'est pas compris renvoie vers le formulaire de réservation (repli).
 */

export const SERVICES = {
  chignon: { words: ["chignon", "mariage", "mariée", "wedding", "bride", "bridal", "عرس", "عروسة", "عروس"], category: "coiffure", search: ["chignon", "mariée"] },
  coupe: { words: ["coupe", "couper", "cut", "haircut", "trim", "قص", "قصة"], category: "coiffure", search: ["coupe"] },
  brushing: { words: ["brushing", "blow", "blowdry", "سشوار", "بروشينغ"], category: "coiffure", search: ["brushing"] },
  couleur: { words: ["couleur", "coloration", "color", "colour", "balayage", "mèches", "racines", "highlights", "صبغة", "ميش"], category: "coiffure", search: ["coloration", "balayage", "couleur"] },
  barbe: { words: ["barbe", "barbier", "beard", "rasage", "shave", "لحية", "حلاق"], category: "barbier", search: ["barbe", "rasage"] },
  ongles: { words: ["manucure", "ongles", "nails", "manicure", "pédicure", "pedicure", "vernis", "gel", "أظافر", "مانيكير"], category: "ongles", search: ["manucure", "ongles", "pose"] },
  soin: { words: ["soin", "visage", "facial", "hydratant", "peau", "skin", "بشرة", "وجه"], category: "visage", search: ["soin"] },
  massage: { words: ["massage", "hammam", "spa", "gommage", "مساج", "حمام", "تدليك"], category: "spa", search: ["massage", "hammam"] },
  maquillage: { words: ["maquillage", "makeup", "make-up", "مكياج", "ماكياج"], category: "maquillage", search: ["maquillage"] },
  epilation: { words: ["épilation", "epilation", "waxing", "wax", "سير", "إزالة"], category: "visage", search: ["épilation"] },
} as const;
export type ServiceIntent = keyof typeof SERVICES;

export const FAQ_TOPICS = {
  cancel: ["annuler", "annulation", "reporter", "report", "cancel", "reschedule", "إلغاء", "نلغي", "تأجيل"],
  deposit: ["acompte", "payer", "paiement", "carte", "deposit", "pay", "payment", "card", "عربون", "دفع", "خلاص"],
  points: ["points", "fidélité", "récompense", "loyalty", "reward", "نقاط", "مكافأة"],
  hours: ["horaire", "horaires", "ouvert", "ouverture", "ferme", "fermé", "opening", "open", "hours", "close", "مفتوح", "وقت", "الأوقات"],
  queue: ["file", "sans rendez-vous", "walk-in", "walk in", "attente", "queue", "طابور", "دون موعد"],
  human: ["humain", "conseillère", "conseiller", "agent", "support", "contact", "human", "person", "إنسان", "موظف", "اتصال"],
} as const;
export type FaqTopic = keyof typeof FAQ_TOPICS;

const WEEKDAYS: [number, string[]][] = [
  [0, ["dimanche", "sunday", "الأحد", "الاحد", "احد"]],
  [1, ["lundi", "monday", "الاثنين", "الإثنين", "اثنين"]],
  [2, ["mardi", "tuesday", "الثلاثاء", "ثلاثاء"]],
  [3, ["mercredi", "wednesday", "الأربعاء", "الاربعاء", "اربعاء"]],
  [4, ["jeudi", "thursday", "الخميس", "خميس"]],
  [5, ["vendredi", "friday", "الجمعة", "جمعة"]],
  [6, ["samedi", "saturday", "السبت", "سبت"]],
];
const PARTS = {
  morning: ["matin", "matinée", "morning", "صباح", "الصباح", "الصبح"],
  afternoon: ["après-midi", "aprem", "afternoon", "بعد الظهر", "العشية", "عشية"],
  evening: ["soir", "soirée", "evening", "tonight", "مساء", "الليل", "ليلا"],
} as const;
export type DayPart = keyof typeof PARTS;
const GREETINGS = ["bonjour", "salut", "bonsoir", "hello", "hi", "hey", "salam", "السلام", "مرحبا", "عسلامة", "أهلا"];
const THANKS = ["merci", "thanks", "thank you", "شكرا", "يعطيك الصحة", "بارك الله"];

export type Parsed = {
  intent: "book" | "faq" | "greeting" | "thanks" | "unknown";
  service: ServiceIntent | null;
  topic: FaqTopic | null;
  date: string | null;
  part: DayPart | null;
  time: string | null;
  city: string | null;
};

const normalize = (text: string) => ` ${text.toLowerCase().normalize("NFC").replace(/[’']/g, "'").replace(/[^\p{L}\p{N}':\-/ ]+/gu, " ").replace(/\s+/g, " ")} `;
const hasWord = (text: string, word: string) => text.includes(` ${word} `) || (word.includes(" ") && text.includes(word)) || (/\p{Script=Arabic}/u.test(word) && text.includes(word));

function parseDate(text: string, now: Date): string | null {
  const today = tunisToday(now);
  const weekday = utcToTunis(now).weekday;
  if (["après-demain", "apres-demain", "بعد غدوة", "بعد غد"].some((w) => text.includes(w))) return addDays(today, 2);
  if (["demain", "tomorrow", "غدوة", "غدا"].some((w) => hasWord(text, w))) return addDays(today, 1);
  if (["aujourd'hui", "aujourdhui", "today", "اليوم", "tonight", "ce soir"].some((w) => text.includes(w))) return today;
  if (["week-end", "weekend", "wikend", "الويكاند", "نهاية الأسبوع"].some((w) => text.includes(w))) return addDays(today, (6 - weekday + 7) % 7);
  for (const [day, words] of WEEKDAYS) {
    if (words.some((w) => hasWord(text, w))) return addDays(today, (day - weekday + 7) % 7);
  }
  const numeric = text.match(/ (\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))? /);
  const dayOnly = text.match(/ (?:le|the) (\d{1,2})(?:er)? /);
  const [y, m] = today.split("-").map(Number);
  const pick = (d: number, month: number) => {
    if (d < 1 || d > 31 || month < 1 || month > 12) return null;
    let year = y;
    let iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso < today) iso = `${++year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return iso;
  };
  if (numeric) return pick(Number(numeric[1]), Number(numeric[2]));
  if (dayOnly) {
    const d = Number(dayOnly[1]);
    const thisMonth = pick(d, m);
    return thisMonth && thisMonth >= today && thisMonth.slice(0, 7) === today.slice(0, 7) ? thisMonth : pick(d, m === 12 ? 1 : m + 1);
  }
  return null;
}

function parseTime(text: string): string | null {
  const match = text.match(/ (?:à |a |at |vers |around )?(\d{1,2})(?:h|:|ه)(\d{2})? /) ?? text.match(/ (\d{1,2}) ?(?:am|pm) /);
  if (!match) return null;
  let hour = Number(match[1]);
  if (/pm/.test(match[0]) && hour < 12) hour += 12;
  if (hour < 7 || hour > 22) return null;
  return `${String(hour).padStart(2, "0")}:${match[2] ?? "00"}`;
}

export function parseMessage(message: string, now: Date, cities: string[]): Parsed {
  const text = normalize(message);
  const service = (Object.keys(SERVICES) as ServiceIntent[]).find((k) => SERVICES[k].words.some((w) => hasWord(text, w))) ?? null;
  const topic = (Object.keys(FAQ_TOPICS) as FaqTopic[]).find((k) => FAQ_TOPICS[k].some((w) => hasWord(text, w) || (w.includes(" ") && text.includes(w)))) ?? null;
  const part = (Object.keys(PARTS) as DayPart[]).find((k) => PARTS[k].some((w) => text.includes(w))) ?? null;
  const city = cities.find((c) => text.includes(` ${c.toLowerCase()} `) || text.includes(c.toLowerCase())) ?? null;
  const date = parseDate(text, now);
  const time = parseTime(text);
  const wantsBooking = service !== null || /(réserver|reserver|rendez-vous|rdv|book|appointment|موعد|نحجز|حجز)/.test(text);

  let intent: Parsed["intent"] = "unknown";
  if (topic && !service) intent = "faq";
  else if (wantsBooking || date || time) intent = "book";
  else if (THANKS.some((w) => text.includes(w))) intent = "thanks";
  else if (GREETINGS.some((w) => hasWord(text, w) || text.includes(w))) intent = "greeting";
  return { intent, service, topic, date, part, time, city };
}

/** Le créneau correspond-il à la demande (heure précise ± 1 h, ou moment de la journée) ? */
export function matchesTime(slot: string, wanted: { part: DayPart | null; time: string | null }) {
  const minutes = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));
  if (wanted.time) {
    const target = Number(wanted.time.slice(0, 2)) * 60 + Number(wanted.time.slice(3, 5));
    return Math.abs(minutes - target) <= 60;
  }
  if (wanted.part === "morning") return minutes < 12 * 60;
  if (wanted.part === "afternoon") return minutes >= 12 * 60 && minutes < 17 * 60;
  if (wanted.part === "evening") return minutes >= 17 * 60;
  return true;
}
