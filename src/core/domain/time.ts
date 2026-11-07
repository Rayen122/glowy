/**
 * Heure de Tunis (Africa/Tunis, UTC+1 toute l'année, pas d'heure d'été).
 * La base stocke des instants UTC ; les créneaux s'expriment en "AAAA-MM-JJ" + "HH:MM" locaux.
 */
const OFFSET_MIN = 60;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "2026-10-03" + "14:00" (heure de Tunis) → instant UTC */
export function tunisToUtc(date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d) + (toMinutes(time) - OFFSET_MIN) * 60_000);
}

/** Instant UTC → date, heure, jour de la semaine (0 = dimanche) et minutes depuis minuit, à Tunis */
export function utcToTunis(instant: Date) {
  const local = new Date(instant.getTime() + OFFSET_MIN * 60_000);
  const iso = local.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    weekday: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

/** Jour de la semaine (0 = dimanche) d'une date "AAAA-MM-JJ" */
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Début et fin (UTC) d'une journée de Tunis */
export const tunisDayRange = (date: string) => ({ start: tunisToUtc(date, "00:00"), end: tunisToUtc(addDays(date, 1), "00:00") });

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const tunisToday = (now = new Date()) => utcToTunis(now).date;

/** Vraie date du calendrier au format AAAA-MM-JJ (refuse « 2026-13-45 » ou « 2026-02-30 ») */
export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(value);
}
