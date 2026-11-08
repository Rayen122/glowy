import { AppError } from "@/core/domain/errors";

/**
 * Limitation de débit (fenêtres glissantes en mémoire) : inscriptions, connexions, réservations, assistante IA,
 * envois de fichiers. Sans elle, un script crée des comptes en rafale, remplit l'agenda d'un salon de demandes
 * fantômes ou vide le quota gratuit de l'IA pour tout le monde. Compteurs propres au processus : suffisant pour
 * un serveur Node unique ; avec plusieurs instances, brancher un stockage partagé (Redis) derrière `hit`.
 * RATE_LIMITS=off les désactive (campagnes de test automatisées en local).
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LIMITS = {
  register: [{ limit: 10, windowMs: HOUR }],
  login: [{ limit: 20, windowMs: 10 * MINUTE }],
  passwordForgot: [{ limit: 5, windowMs: 15 * MINUTE }],
  booking: [{ limit: 15, windowMs: HOUR }],
  chat: [
    { limit: 6, windowMs: MINUTE },
    { limit: 60, windowMs: HOUR },
  ],
  ai: [{ limit: 10, windowMs: MINUTE }],
  /** Rendu photoréaliste de l'essai couleur : chaque image est facturée par Google (~0,04 $) */
  tryOn: [
    { limit: 6, windowMs: 10 * MINUTE },
    { limit: 20, windowMs: DAY },
  ],
  /** Budget de toute la plateforme (clé « all ») : 300 rendus par jour au plus, soit ~12 $ */
  tryOnBudget: [{ limit: 300, windowMs: DAY }],
  upload: [{ limit: 30, windowMs: HOUR }],
  write: [{ limit: 30, windowMs: HOUR }],
} as const satisfies Record<string, readonly { limit: number; windowMs: number }[]>;

export type LimitName = keyof typeof LIMITS;

const hits = new Map<string, number[]>();
const LONGEST_WINDOW = Math.max(...Object.values(LIMITS).flatMap((windows) => windows.map((w) => w.windowMs)));
let lastSweep = 0;

/** Enregistre un passage ; false si l'une des fenêtres de `name` est déjà pleine pour `id` */
export function hit(name: LimitName, id: string, now = Date.now()) {
  const key = `${name}:${id}`;
  const longest = Math.max(...LIMITS[name].map((w) => w.windowMs));
  const recent = (hits.get(key) ?? []).filter((t) => t > now - longest);
  const full = LIMITS[name].some(({ limit, windowMs }) => recent.filter((t) => t > now - windowMs).length >= limit);
  if (!full) recent.push(now);
  hits.set(key, recent);
  if (now - lastSweep > MINUTE) {
    lastSweep = now;
    for (const [k, times] of hits) if (!times.some((t) => t > now - LONGEST_WINDOW)) hits.delete(k);
  }
  return !full;
}

export const rateLimitsEnabled = () => process.env.RATE_LIMITS !== "off" && process.env.NODE_ENV !== "test";

/** Lève 429 RATE_LIMITED quand la limite est atteinte */
export function rateLimit(name: LimitName, id: string) {
  if (rateLimitsEnabled() && !hit(name, id)) {
    throw new AppError(429, "RATE_LIMITED", "Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer.");
  }
}

/** Adresse du client (premier saut du proxy s'il y en a un), sinon « local » */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}
