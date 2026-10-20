import type { I18n } from "@/i18n/format";
import type { Salon } from "@/lib/data";

/** IA P1 : phrase « pourquoi ce salon » dans la langue de la page (raison calculée côté serveur) */
export function recoText(i18n: Pick<I18n, "t" | "f" | "tc" | "nf">, salon: Pick<Salon, "reason" | "aiReason">) {
  const { t, f, tc, nf } = i18n;
  const r = salon.reason;
  if (!r) return salon.aiReason ? tc(salon.aiReason) : null;
  const template = t.reco[r.key as keyof typeof t.reco];
  if (!template) return null;
  const params = { ...r.params };
  if (typeof params.category === "string") params.category = t.categories[params.category as keyof typeof t.categories] ?? params.category;
  if (typeof params.city === "string") params.city = tc(params.city);
  if (typeof params.service === "string") params.service = tc(params.service);
  if (typeof params.rating === "number") params.rating = nf(params.rating);
  return f(template, params);
}
