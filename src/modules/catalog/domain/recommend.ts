/**
 * IA P1 — recommandation de salons (fonctions pures, testées).
 * Score de contenu à partir des habitudes de la cliente (catégories, prestations, ville, budget) +
 * qualité (note bayésienne) + disponibilité du jour. Repli « popularité » sans historique (visiteur, nouveau compte).
 */

export type TasteProfile = {
  /** Part de chaque catégorie dans l'historique (favoris comptés double), somme = 1 */
  categories: Record<string, number>;
  /** Prestations déjà réservées (en minuscules) */
  services: string[];
  city: string | null;
  /** Dépense habituelle par rendez-vous (médiane) */
  typicalSpend: number | null;
  favorites: string[];
  visits: number;
};

export type SalonFeatures = { id: string; category: string; city: string; rating: number; reviews: number; priceFrom: number; services: string[]; slotsToday: number; calm: boolean };

export type ReasonKey = "category" | "service" | "rating" | "city" | "price" | "available" | "popular";
export type Recommendation = { id: string; score: number; reason: { key: ReasonKey; params: Record<string, string | number> }; source: "profile" | "popularity" };

/** Note bayésienne : un salon avec peu d'avis est ramené vers la moyenne (4/5) */
export const bayesianRating = (rating: number, reviews: number, prior = 4, weight = 5) => (prior * weight + rating * reviews) / (weight + reviews);

const SAME_AREA: Record<string, string[]> = { Tunis: ["Tunis", "La Marsa", "Carthage", "El Menzah", "Les Berges du Lac", "Ennasr"] };
function cityScore(salonCity: string, userCity: string | null) {
  if (!userCity) return 0;
  if (salonCity.toLowerCase() === userCity.toLowerCase()) return 1;
  const area = Object.values(SAME_AREA).find((list) => list.includes(salonCity) && list.includes(userCity));
  return area ? 0.6 : 0;
}

export function emptyProfile(): TasteProfile {
  return { categories: {}, services: [], city: null, typicalSpend: null, favorites: [], visits: 0 };
}

export function recommend(salons: SalonFeatures[], profile: TasteProfile): Recommendation[] {
  const coldStart = profile.visits === 0 && profile.favorites.length === 0;
  return salons.map((s) => {
    const quality = Math.max(0, (bayesianRating(s.rating, s.reviews) - 3) / 2);
    const availability = Math.min(1, s.slotsToday / 4) * (s.calm ? 1 : 0.6);
    if (coldStart) {
      const popularity = Math.min(1, Math.log10(1 + s.reviews) / 2);
      const near = cityScore(s.city, profile.city);
      const score = 0.5 * quality + 0.2 * popularity + 0.15 * availability + 0.15 * near;
      const key: ReasonKey = near === 1 ? "city" : quality >= 0.7 && s.reviews >= 3 ? "rating" : availability >= 0.75 ? "available" : "popular";
      return { id: s.id, score: Math.round(score * 100), reason: reasonFor(key, s), source: "popularity" as const };
    }
    const parts: Record<ReasonKey, number> = {
      category: 0.3 * (profile.categories[s.category] ?? 0),
      service: 0.15 * (s.services.some((x) => profile.services.includes(x.toLowerCase())) ? 1 : 0),
      rating: 0.2 * quality,
      city: 0.15 * cityScore(s.city, profile.city),
      price: 0.1 * (profile.typicalSpend ? Math.max(0, 1 - Math.abs(s.priceFrom - profile.typicalSpend * 0.6) / Math.max(profile.typicalSpend, 1)) : 0.5),
      available: 0.1 * availability,
      popular: 0,
    };
    const favorite = profile.favorites.includes(s.id) ? 0.05 : 0;
    const score = Math.min(1, Object.values(parts).reduce((a, b) => a + b, 0) + favorite);
    // Raison : la composante qui pèse le plus, rapportée à son poids maximal (plus lisible qu'un total)
    const weights: Record<ReasonKey, number> = { category: 0.3, service: 0.15, rating: 0.2, city: 0.15, price: 0.1, available: 0.1, popular: 1 };
    const key = (Object.keys(parts) as ReasonKey[]).filter((k) => k !== "popular").sort((a, b) => parts[b] / weights[b] - parts[a] / weights[a] || weights[b] - weights[a])[0];
    const sharedService = s.services.find((x) => profile.services.includes(x.toLowerCase()));
    return { id: s.id, score: Math.round(score * 100), reason: reasonFor(key, s, sharedService), source: "profile" as const };
  });
}

function reasonFor(key: ReasonKey, s: SalonFeatures, service?: string): Recommendation["reason"] {
  switch (key) {
    case "category":
      return { key, params: { category: s.category } };
    case "service":
      return { key, params: { service: service ?? "" } };
    case "rating":
      return { key, params: { rating: Math.round(s.rating * 10) / 10, reviews: s.reviews } };
    case "city":
      return { key, params: { city: s.city } };
    case "price":
      return { key, params: { price: s.priceFrom } };
    case "available":
      return { key, params: { slots: s.slotsToday } };
    default:
      return { key: "popular", params: {} };
  }
}

/** Profil à partir de l'historique (rendez-vous terminés) et des favoris */
export function buildProfile(input: { visits: { category: string; services: string[]; total: number; city: string }[]; favorites: { id: string; category: string }[]; city: string | null }): TasteProfile {
  const weights: Record<string, number> = {};
  for (const v of input.visits) weights[v.category] = (weights[v.category] ?? 0) + 1;
  for (const f of input.favorites) weights[f.category] = (weights[f.category] ?? 0) + 2;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const totals = input.visits.map((v) => v.total).sort((a, b) => a - b);
  const cities = input.visits.map((v) => v.city);
  const topCity = cities.sort((a, b) => cities.filter((c) => c === b).length - cities.filter((c) => c === a).length)[0] ?? null;
  return {
    categories: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, total ? v / total : 0])),
    services: [...new Set(input.visits.flatMap((v) => v.services.map((x) => x.toLowerCase())))],
    city: input.city ?? topCity,
    typicalSpend: totals.length ? totals[Math.floor(totals.length / 2)] : null,
    favorites: input.favorites.map((f) => f.id),
    visits: input.visits.length,
  };
}

/**
 * Classement proposé par le modèle d'IA, contrôlé : uniquement des salons de la liste, sans doublon (6 au plus), raison
 * courte ; les autres suivent dans l'ordre du score. Les scores sont réajustés pour que le tri « Recommandé pour vous »
 * (fait aussi dans le navigateur) respecte ce classement.
 */
export function applyAiRanking<T extends { slug: string; matchScore: number }>(salons: T[], ranking: { slug: string; reason: string }[], max = 6) {
  const bySlug = new Map(salons.map((s) => [s.slug, s]));
  const ranked: (T & { aiReason: string })[] = [];
  for (const r of ranking) {
    const salon = bySlug.get(r.slug);
    if (!salon || ranked.length >= max || ranked.some((x) => x.slug === r.slug)) continue;
    ranked.push({ ...salon, aiReason: String(r.reason ?? "").trim().slice(0, 160), matchScore: 100 - ranked.length });
  }
  const floor = 100 - ranked.length - 1;
  const rest = salons
    .filter((s) => !ranked.some((x) => x.slug === s.slug))
    .sort((a, b) => b.matchScore - a.matchScore)
    .map((s) => ({ ...s, matchScore: Math.min(s.matchScore, floor) }));
  return { ranked, rest };
}
