import { toMinutes } from "@/core/domain/time";

/**
 * IA P2 — prévision d'affluence et affluence en direct (RES-08). Fonctions pures, testées.
 * Modèle : taux d'occupation de l'équipe par heure, moyenne pondérée des mêmes jours de semaine
 * sur les 8 dernières semaines (les semaines récentes comptent plus). Repli : courbe type d'un salon
 * quand l'historique est insuffisant (nouveau salon).
 */

export type Affluence = "calme" | "moderee" | "forte";
export type ForecastPoint = { hour: number; value: number };
export type Interval = { startsAt: Date; endsAt: Date };

export const WEEKS = 8;
const DECAY = 0.8;

export const levelFor = (value: number): Affluence => (value < 35 ? "calme" : value < 70 ? "moderee" : "forte");

/** Courbe type (en %) d'un salon de quartier, utilisée tant qu'il n'y a pas assez d'historique */
const TYPICAL: Record<number, number> = { 8: 10, 9: 20, 10: 25, 11: 35, 12: 40, 13: 35, 14: 45, 15: 60, 16: 75, 17: 85, 18: 80, 19: 55, 20: 30, 21: 15 };

const hoursOf = (opening: { opensAt: string; closesAt: string }) => {
  const from = Math.floor(toMinutes(opening.opensAt) / 60);
  const to = Math.ceil(toMinutes(opening.closesAt) / 60);
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
};

/** Minutes de [start, end[ comprises dans l'heure `hour` (heure locale, minutes depuis minuit) */
const overlap = (start: number, end: number, hour: number) => Math.max(0, Math.min(end, (hour + 1) * 60) - Math.max(start, hour * 60));

/**
 * Prévision d'un jour : `weeks[k]` = rendez-vous (en minutes locales) du même jour de la semaine il y a k+1 semaines.
 * capacity = nombre de professionnels actifs. Renvoie la source pour l'afficher honnêtement.
 */
export function forecastDay(weeks: { start: number; end: number }[][], capacity: number, opening: { opensAt: string; closesAt: string } | null) {
  if (!opening) return { points: [] as ForecastPoint[], source: "closed" as const };
  const hours = hoursOf(opening);
  const withData = weeks.filter((w) => w.length > 0).length;
  if (withData < 2 || capacity <= 0) {
    return { points: hours.map((hour) => ({ hour, value: TYPICAL[hour] ?? 30 })), source: "fallback" as const };
  }
  const weights = weeks.map((_, k) => DECAY ** k);
  const total = weights.reduce((a, w) => a + w, 0);
  const points = hours.map((hour) => {
    const occupancy = weeks.reduce((sum, bookings, k) => sum + weights[k] * Math.min(1, bookings.reduce((m, b) => m + overlap(b.start, b.end, hour), 0) / (capacity * 60)), 0) / total;
    return { hour, value: Math.round(occupancy * 100) };
  });
  return { points, source: "history" as const };
}

/** Meilleur moment : la fenêtre de 2 heures la plus calme (à partir de l'heure courante si `fromHour`) */
export function bestWindow(points: ForecastPoint[], fromHour = 0) {
  const candidates = points.filter((p) => p.hour >= fromHour);
  let best: { from: number; to: number; value: number } | null = null;
  for (let i = 0; i + 1 < candidates.length; i += 1) {
    const value = (candidates[i].value + candidates[i + 1].value) / 2;
    if (!best || value < best.value) best = { from: candidates[i].hour, to: candidates[i + 1].hour + 1, value };
  }
  return best;
}

/** Heures creuses prévues (moins de 35 % d'occupation) */
export const offPeakHours = (points: ForecastPoint[]) => points.filter((p) => p.value < 35).map((p) => p.hour);

/**
 * Affluence en direct : professionnels occupés maintenant, file d'attente, temps d'attente estimé.
 * busyUntil = fin (en minutes depuis maintenant) du rendez-vous en cours de chaque professionnel occupé.
 */
export function liveStatus(input: { capacity: number; busyUntil: number[]; waiting: number; avgServiceMin: number }) {
  const { capacity, busyUntil, waiting, avgServiceMin } = input;
  if (capacity <= 0) return { level: "calme" as Affluence, waitMinutes: 0, occupancy: 0 };
  const busy = Math.min(capacity, busyUntil.length);
  const occupancy = Math.round(((busy + waiting) / capacity) * 100);
  return { level: levelFor(occupancy), waitMinutes: waitFor(waiting + 1, { capacity, busyUntil, avgServiceMin }), occupancy: Math.min(occupancy, 100) };
}

/** Attente estimée pour la personne en `position` (1 = prochaine) dans la file */
export function waitFor(position: number, input: { capacity: number; busyUntil: number[]; avgServiceMin: number }) {
  const { capacity, busyUntil, avgServiceMin } = input;
  if (capacity <= 0) return 0;
  // Disponibilité de chaque professionnel (0 = libre), puis chaque personne de la file prend le premier libre
  const free = [...busyUntil.slice(0, capacity).map((m) => Math.max(0, Math.round(m))), ...Array(Math.max(0, capacity - busyUntil.length)).fill(0)].sort((a, b) => a - b);
  let wait = 0;
  for (let i = 0; i < position; i += 1) {
    wait = free[0];
    free[0] += avgServiceMin;
    free.sort((a, b) => a - b);
  }
  return wait;
}
