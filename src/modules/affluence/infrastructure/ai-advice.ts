import { ttlCache, withTimeout } from "@/infrastructure/ai/cache";
import { geminiEnabled, generateJson } from "@/infrastructure/ai/gemini";
import { objectId, Salon } from "@/infrastructure/db";

/**
 * IA P2 avec un vrai modèle (Gemini) : la prévision chiffrée reste statistique (moyenne pondérée des 8 dernières semaines,
 * la méthode la plus fiable) ; le modèle l'analyse et rédige des conseils concrets pour le gérant (renfort, offre ciblée…).
 * Gardés 6 heures par salon ; sans clé, sans historique réel ou si le modèle tarde : pas de conseils (la prévision reste affichée).
 */

export type AdviceLang = "fr" | "ar" | "en";
export type AffluenceTip = { title: string; text: string };
type WeekForecast = { days: number[]; values: number[][]; source: string | null };

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const LANGS: Record<AdviceLang, string> = { fr: "français, en vouvoyant", ar: "arabe standard", en: "anglais" };

const instruction = (lang: AdviceLang) => `Tu es l'IA d'affluence de Glowy, plateforme tunisienne de salons de beauté.
Tu reçois l'occupation prévue de l'équipe d'un salon (en %, par jour et par heure) pour les 6 prochains jours, et ses prestations.
Donne 3 conseils concrets et différents au gérant, en ${LANGS[lang]} : où renforcer l'équipe aux heures pleines, quelle offre lancer
(prestation précise de la liste + jour + tranche horaire) pour remplir un creux, et un conseil d'organisation (pauses, rendez-vous longs,
formation aux heures calmes). Cite les jours, les heures et les pourcentages exacts du tableau, n'invente aucun chiffre.
title : 6 mots au plus ; text : une phrase.`;

const SCHEMA = {
  type: "OBJECT",
  properties: { tips: { type: "ARRAY", items: { type: "OBJECT", properties: { title: { type: "STRING" }, text: { type: "STRING" } }, required: ["title", "text"] } } },
  required: ["tips"],
};

const cache = ttlCache<AffluenceTip[]>(6 * 3_600_000);

/** Conseils de la semaine rédigés par le modèle ; null si le modèle n'est pas utilisable (la page n'attend pas plus de 6 s) */
export async function affluenceAdvice(salonId: string, week: WeekForecast, hours: readonly number[], lang: AdviceLang): Promise<AffluenceTip[] | null> {
  if (!geminiEnabled() || week.source !== "history" || !week.days.length) return null;
  const key = `${salonId}:${lang}:${week.values.flat().join(",")}`;
  try {
    return await withTimeout(
      cache(key, async () => {
        const salon = await Salon.findById(objectId(salonId), { name: 1, services: 1 }).lean();
        const services = (salon?.services ?? []).filter((s) => s.active).slice(0, 12).map((s) => `${s.name} ${s.price} DT (${s.durationMin} min)`);
        const table = week.days.map((day, i) => `${DAYS[day]} : ${hours.map((h, j) => `${h} h ${week.values[i][j]} %`).join(", ")}`).join("\n");
        const result = await generateJson<{ tips: AffluenceTip[] }>(instruction(lang), [{ text: `Salon : ${salon?.name ?? ""}\nOccupation prévue :\n${table}\n\nPrestations : ${services.join(" ; ")}` }], SCHEMA, { temperature: 0.3 });
        if (result === "blocked") throw new Error("contenu bloqué");
        return result.tips.filter((t) => t.title?.trim() && t.text?.trim()).slice(0, 3).map((t) => ({ title: t.title.trim().slice(0, 80), text: t.text.trim().slice(0, 280) }));
      }),
      6_000
    );
  } catch (error) {
    console.warn("[affluence] conseils de l'IA indisponibles :", (error as Error).message);
    return null;
  }
}
