/** Langues de l'interface (CLI-06) : français, arabe (droite à gauche), anglais. */
export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const LOCALE_META: Record<Locale, { label: string; short: string; dir: "ltr" | "rtl"; intl: string }> = {
  fr: { label: "Français", short: "FR", dir: "ltr", intl: "fr-FR" },
  ar: { label: "العربية", short: "ع", dir: "rtl", intl: "ar-TN" },
  en: { label: "English", short: "EN", dir: "ltr", intl: "en-GB" },
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);
