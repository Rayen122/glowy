/** Horloge injectée dans les cas d'usage : les tests fixent « maintenant » sans toucher à l'heure système */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Horloge réglable (tests) : `clock.set(date)` déplace « maintenant » */
export function manualClock(start: Date) {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    set: (date: Date) => {
      current = new Date(date);
    },
  };
}
