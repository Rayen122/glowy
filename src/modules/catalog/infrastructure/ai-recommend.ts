import { ttlCache, withTimeout } from "@/infrastructure/ai/cache";
import { geminiEnabled, generateJson } from "@/infrastructure/ai/gemini";
import type { Salon as SalonView } from "@/lib/data";
import { applyAiRanking, type TasteProfile } from "../domain/recommend";

/**
 * IA P1 avec un vrai modèle (Gemini) : à partir des goûts de la cliente et d'une présélection faite par le score local,
 * le modèle choisit et classe les salons qui lui conviennent le mieux et écrit la raison « Pourquoi ce salon ? ».
 * Résultat gardé 30 minutes par cliente ; sans clé, sans historique ou si le modèle tarde : score local.
 */

export type RankLang = "fr" | "ar" | "en";
const LANGS: Record<RankLang, string> = { fr: "français, en vouvoyant", ar: "arabe standard", en: "anglais" };

const instruction = (lang: RankLang) => `Tu es le moteur de recommandation de Glowy, plateforme tunisienne de réservation de salons de beauté.
Tu reçois le profil d'une cliente (d'après ses rendez-vous terminés et ses favoris) et une liste de salons candidats.
Classe au plus 6 salons, du plus adapté au moins adapté pour ELLE : catégories et prestations qu'elle réserve, sa ville ou sa
région, son budget habituel, la qualité (note et nombre d'avis), la disponibilité du jour. Garde ses salons préférés en bonne place
mais propose aussi une découverte pertinente. Pour chacun, une raison de 14 mots au plus en ${LANGS[lang]}, adressée à la cliente,
fondée uniquement sur les données fournies (jamais de prix, d'horaire ou de qualité inventés). Utilise les slugs exacts.`;

const SCHEMA = {
  type: "OBJECT",
  properties: { ranking: { type: "ARRAY", items: { type: "OBJECT", properties: { slug: { type: "STRING" }, reason: { type: "STRING" } }, required: ["slug", "reason"] } } },
  required: ["ranking"],
};

const describeProfile = (p: TasteProfile, favorites: string[]) =>
  [
    `Rendez-vous terminés : ${p.visits}`,
    `Catégories : ${Object.entries(p.categories).map(([c, share]) => `${c} ${Math.round(share * 100)} %`).join(", ") || "aucune"}`,
    `Prestations déjà réservées : ${p.services.slice(0, 12).join(", ") || "aucune"}`,
    `Ville : ${p.city ?? "inconnue"}`,
    `Dépense habituelle par rendez-vous : ${p.typicalSpend ? `${p.typicalSpend} DT` : "inconnue"}`,
    `Salons favoris : ${favorites.join(", ") || "aucun"}`,
  ].join("\n");

const describeSalon = (s: SalonView) =>
  `${s.slug} | ${s.name} | ${s.category} | ${s.city} | ${s.reviewCount ? `${s.rating}/5 (${s.reviewCount} avis)` : "sans avis"} | dès ${s.priceFrom} DT | ${s.visited ? "déjà visité" : "jamais visité"} | ${s.nextSlots.length} créneau(x) aujourd'hui | ${s.topServices.slice(0, 5).map((t) => t.name).join(", ")}`;

const cache = ttlCache<{ slug: string; reason: string }[]>(30 * 60_000);

/** Salons classés par le modèle (les 6 premiers portent la raison écrite par l'IA), puis les autres ; inchangé si le modèle n'est pas utilisable */
export async function aiRank(salons: SalonView[], profile: TasteProfile, userId: string, lang: RankLang): Promise<SalonView[]> {
  if (!geminiEnabled() || salons.length < 2 || (profile.visits === 0 && profile.favorites.length === 0)) return salons;
  const candidates = [...salons].sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
  const favorites = salons.filter((s) => s.favorite).map((s) => s.name);
  const key = `${userId}:${lang}:${profile.visits}:${favorites.length}:${candidates.map((c) => c.slug).join(",")}`;
  try {
    const ranking = await withTimeout(
      cache(key, async () => {
        const result = await generateJson<{ ranking: { slug: string; reason: string }[] }>(instruction(lang), [{ text: `Profil de la cliente :\n${describeProfile(profile, favorites)}\n\nSalons candidats (slug | nom | catégorie | ville | note | prix | visite | dispo | prestations) :\n${candidates.map(describeSalon).join("\n")}` }], SCHEMA, { temperature: 0.2 });
        if (result === "blocked") throw new Error("contenu bloqué");
        return result.ranking;
      }),
      6_000
    );
    const { ranked, rest } = applyAiRanking(salons, ranking);
    if (!ranked.length) return salons;
    // Raison écrite par l'IA (affichée telle quelle) à la place de la raison calculée
    return [...ranked.map((s) => ({ ...s, reason: undefined })), ...rest];
  } catch (error) {
    console.warn("[recommandation] modèle d'IA indisponible, score local :", (error as Error).message);
    return salons;
  }
}
