import { objectId, PhotoAnalysis, Salon } from "@/infrastructure/db";
import { searchSalons } from "@/modules/catalog";
import { award } from "@/modules/loyalty";
import { diagnose, type BeautyMode, type Metrics } from "../domain/analysis";

const CATEGORIES: Record<BeautyMode, string[]> = { cheveux: ["coiffure"], visage: ["visage", "spa", "maquillage"] };

/** Prestations réelles des salons adaptés, dans l'ordre de la recommandation (IA P1) : une par terme, sans doublon */
async function recommendedServices(userId: string | null, mode: BeautyMode, terms: string[]) {
  const salons = (await searchSalons({}, userId ?? undefined)).filter((s) => CATEGORIES[mode].includes(s.category));
  const docs = await Salon.find({ slug: { $in: salons.map((s) => s.slug) } }, { slug: 1, name: 1, services: 1 }).lean();
  const picked: { name: string; salon: string; slug: string; service: string; price: number }[] = [];
  for (const term of terms) {
    for (const view of salons) {
      if (picked.length >= 3) return picked;
      const doc = docs.find((d) => d.slug === view.slug);
      const service = doc?.services.find((s) => s.active && s.name.toLowerCase().includes(term) && !picked.some((p) => p.slug === doc.slug && p.service === s.key));
      if (doc && service) {
        picked.push({ name: service.name, salon: doc.name, slug: doc.slug, service: service.key, price: service.price });
        break; // terme suivant : varier les soins proposés
      }
    }
  }
  return picked;
}

/**
 * IA P5 : diagnostic à partir des mesures, soins proposés ; pour une cliente connectée, résultat enregistré
 * dans son historique et points « analyse photo » crédités (1 fois par mois, plafond du barème).
 */
export async function beautyAnalysis(userId: string | null, mode: BeautyMode, metrics: Metrics) {
  const diagnosis = diagnose(mode, metrics);
  if (diagnosis.kind === "retake") return diagnosis;
  const services = await recommendedServices(userId, mode, diagnosis.terms);
  let points = 0;
  if (userId) {
    await PhotoAnalysis.create({ user: objectId(userId)!, mode, result: { score: diagnosis.score, issues: diagnosis.issues, metrics } });
    points = await award(userId, "PHOTO_ANALYSIS", { label: mode === "cheveux" ? "Cheveux" : "Visage" });
  }
  return { ...diagnosis, services, points, saved: Boolean(userId) };
}

export type BeautyResult = Awaited<ReturnType<typeof beautyAnalysis>>;
