import { fromMinutes, toMinutes, tunisToUtc } from "@/core/domain/time";
import { isOffPeak, SLOT_STEP_MIN, startsTooSoon } from "./policy";

/** Calcul des créneaux libres d'une journée — pur : la journée est chargée par l'infrastructure. */

export type Interval = { start: number; end: number };

export type DaySchedule = {
  date: string;
  weekday: number;
  /** null : salon fermé ce jour-là */
  opening: { opensAt: string; closesAt: string } | null;
  employees: { id: string; key: string; workingHours: { startsAt: string; endsAt: string } | null }[];
  /** Plages occupées par employé (réservations actives et congés), en millisecondes UTC */
  busy: Map<string, Interval[]>;
};

type ScheduleEmployee = DaySchedule["employees"][number];

export type Slot = { time: string; employees: string[]; offPeak: boolean };

/** Plage de travail d'un employé (ses horaires, limités à ceux du salon), en minutes */
export function workWindow(employee: ScheduleEmployee, opening: NonNullable<DaySchedule["opening"]>) {
  const open = toMinutes(opening.opensAt);
  const close = toMinutes(opening.closesAt);
  const own = employee.workingHours;
  return own ? { from: Math.max(open, toMinutes(own.startsAt)), to: Math.min(close, toMinutes(own.endsAt)) } : { from: open, to: close };
}

export function isFree(day: DaySchedule, employee: ScheduleEmployee, minutes: number, durationMin: number) {
  if (!day.opening) return false;
  const window = workWindow(employee, day.opening);
  if (minutes < window.from || minutes + durationMin > window.to) return false;
  const start = tunisToUtc(day.date, fromMinutes(minutes)).getTime();
  const end = start + durationMin * 60_000;
  return !(day.busy.get(employee.id) ?? []).some((i) => i.start < end && i.end > start);
}

export const freeEmployees = (day: DaySchedule, minutes: number, durationMin: number) =>
  day.employees.filter((e) => isFree(day, e, minutes, durationMin));

/** Créneaux de la journée (pas de 30 min) avec, pour chacun, les employés libres (clés). */
export function computeSlots(day: DaySchedule, durationMin: number, now: Date, offPeakHours?: number[] | null): { date: string; closed: boolean; slots: Slot[] } {
  if (!day.opening) return { date: day.date, closed: true, slots: [] };
  const slots: Slot[] = [];
  for (let m = toMinutes(day.opening.opensAt); m + durationMin <= toMinutes(day.opening.closesAt); m += SLOT_STEP_MIN) {
    if (startsTooSoon(tunisToUtc(day.date, fromMinutes(m)), now)) continue;
    slots.push({ time: fromMinutes(m), employees: freeEmployees(day, m, durationMin).map((e) => e.key), offPeak: isOffPeak(day.weekday, m, offPeakHours) });
  }
  return { date: day.date, closed: false, slots };
}
