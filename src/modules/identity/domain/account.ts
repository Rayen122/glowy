import { randomCode } from "@/core/domain/text";

/** Règles pures des comptes (P1, AUTH-01 à AUTH-03) — sans base de données ni framework. */

export type UserStatus = "ACTIVE" | "BLOCKED";
export type Locale = "fr" | "ar" | "en";

/** Blocage temporaire après 5 mots de passe faux consécutifs, pendant 15 minutes (cahier §10) */
export const LOGIN_POLICY = { maxFailed: 5, lockMinutes: 15 } as const;

export type LoginState = { failedLogins: number; lockedUntil: Date | null };

export const isLocked = (state: LoginState, now: Date) => Boolean(state.lockedUntil && state.lockedUntil > now);

/** État après un mot de passe faux : compteur + 1, ou verrouillage au 5e échec (le compteur repart à zéro) */
export function afterFailedLogin(state: LoginState, now: Date): LoginState & { locked: boolean } {
  const failed = state.failedLogins + 1;
  if (failed >= LOGIN_POLICY.maxFailed) {
    return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOGIN_POLICY.lockMinutes * 60_000), locked: true };
  }
  return { failedLogins: failed, lockedUntil: state.lockedUntil, locked: false };
}

/** Coordonnées par défaut des villes (le gérant affine la position dans ses paramètres) */
export const CITY_COORDS: Record<string, [number, number]> = {
  tunis: [36.8065, 10.1815],
  "la marsa": [36.8782, 10.3247],
  carthage: [36.8528, 10.3233],
  ariana: [36.8625, 10.1956],
  sousse: [35.8256, 10.636],
  sfax: [34.7406, 10.7603],
  nabeul: [36.4561, 10.7376],
  hammamet: [36.4, 10.6167],
  monastir: [35.7643, 10.8113],
  bizerte: [37.2744, 9.8739],
};

export const coordsFor = (city: string) => CITY_COORDS[city.trim().toLowerCase()] ?? CITY_COORDS.tunis;

/** Code de parrainage : prénom (ou nom du salon) sans accents + 4 caractères, ex. SARRA-K7QF */
export const referralCandidate = (base: string) => {
  const prefix = base.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 8) || "BH";
  return `${prefix}-${randomCode(4)}`;
};
