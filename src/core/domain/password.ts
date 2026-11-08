/**
 * Politique des mots de passe (AUTH-01, cahier §10) — règle pure, partagée par l'API et les formulaires.
 * 8 caractères minimum, au moins une lettre et un chiffre ou symbole, assez de caractères différents,
 * et pas un des mots de passe les plus essayés (« aaaaaaaa », « 12345678 », « motdepasse1 »…).
 */
export const PASSWORD_MIN = 8;

const COMMON = new Set([
  "password",
  "password1",
  "motdepasse",
  "motdepasse1",
  "azertyui",
  "azertyuiop",
  "azerty123",
  "qwertyui",
  "qwerty123",
  "abcd1234",
  "abc12345",
  "iloveyou",
  "tunisie1",
  "tunis123",
  "glowy123",
  "glowy2026",
]);

export function isWeakPassword(value: string) {
  if (value.length < PASSWORD_MIN) return true;
  const lower = value.toLowerCase();
  if (COMMON.has(lower) || new Set(lower).size < 4) return true;
  return !(/\p{L}/u.test(value) && /[^\p{L}]/u.test(value));
}
