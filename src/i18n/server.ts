import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { makeI18n } from "./format";

const dictionaries = {
  fr: () => import("./dictionaries/fr").then((m) => m.fr),
  ar: () => import("./dictionaries/ar").then((m) => m.ar),
  en: () => import("./dictionaries/en").then((m) => m.en),
};

/** Langue : cookie choisi par l'utilisateur, sinon langue du navigateur, sinon français. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
});

export const getDictionary = cache(async (locale: Locale) => dictionaries[locale]());

/** À utiliser dans les composants serveur : const { t, tc, f } = await getI18n(); */
export async function getI18n() {
  const locale = await getLocale();
  return makeI18n(locale, await getDictionary(locale));
}
