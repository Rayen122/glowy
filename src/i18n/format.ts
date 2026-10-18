import { LOCALE_META, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/fr";

/**
 * Outils de traduction partagés serveur / client.
 *  t      dictionnaire typé (t.home.hero.title…)
 *  f      interpolation : f("{n} salons", { n: 3 })
 *  tc     contenu des données de démo (clé = texte français, repli sur le français)
 *  nf     nombre localisé · money : montant en dinars · dur : durée (minutes)
 *  df     date ISO (AAAA-MM-JJ) localisée · rtf / ago : temps relatif (« il y a 2 h »)
 */
export function makeI18n(locale: Locale, t: Dictionary) {
  const meta = LOCALE_META[locale];
  const numberFormat = new Intl.NumberFormat(meta.intl);

  const f = (template: string, vars: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
  const nf = (n: number, opts?: Intl.NumberFormatOptions) =>
    (opts ? new Intl.NumberFormat(meta.intl, opts) : numberFormat).format(n);

  return {
    locale,
    dir: meta.dir,
    intl: meta.intl,
    t,
    f,
    tc: (text: string) => t.content[text] ?? text,
    /** Interpolation avec éléments (ex. <strong>) : rich("Créneau {slot}", { slot: <strong key="s">…</strong> }) */
    rich: <T,>(template: string, vars: Record<string, T>) =>
      template.split(/(\{\w+\})/).map((part) => {
        const key = part.match(/^\{(\w+)\}$/)?.[1];
        return key && key in vars ? vars[key] : part;
      }),
    nf,
    money: (n: number) => `${nf(n)} ${t.common.currency}`,
    dur: (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (!h) return f(t.common.durMin, { m });
      return m ? f(t.common.durHourMin, { h, m: String(m).padStart(2, "0") }) : f(t.common.durHour, { h });
    },
    hour: (h: number) => f(t.common.hourShort, { h }),
    df: (iso: string, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(meta.intl, { timeZone: "UTC", ...opts }).format(new Date(`${iso}T12:00:00Z`)),
    rtf: (value: number, unit: Intl.RelativeTimeFormatUnit) =>
      new Intl.RelativeTimeFormat(meta.intl, { numeric: "auto" }).format(value, unit),
    /** Ancienneté en minutes → « il y a 12 minutes », « il y a 2 heures », « hier » */
    ago: (minutes: number) => {
      const rtf = new Intl.RelativeTimeFormat(meta.intl, { numeric: "auto" });
      if (minutes < 60) return rtf.format(-minutes, "minute");
      if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), "hour");
      return rtf.format(-Math.round(minutes / (60 * 24)), "day");
    },
  };
}

export type I18n = ReturnType<typeof makeI18n>;
