"use client";

import { createContext, useContext, useMemo } from "react";
import { LOCALES, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/fr";
import { makeI18n, type I18n } from "./format";

const I18nContext = createContext<I18n | null>(null);

const LocalesContext = createContext<readonly Locale[]>(LOCALES);

export function I18nProvider({ locale, dict, locales = LOCALES, children }: { locale: Locale; dict: Dictionary; locales?: readonly Locale[]; children: React.ReactNode }) {
  const value = useMemo(() => makeI18n(locale, dict), [locale, dict]);
  return (
    <I18nContext.Provider value={value}>
      <LocalesContext.Provider value={locales}>{children}</LocalesContext.Provider>
    </I18nContext.Provider>
  );
}

/** Langues proposées dans le sélecteur (activées par le Super Admin, ADM-06) */
export const useEnabledLocales = () => useContext(LocalesContext);

/** À utiliser dans les composants client : const { t, tc, f } = useI18n(); */
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n doit être utilisé sous <I18nProvider>");
  return value;
}
