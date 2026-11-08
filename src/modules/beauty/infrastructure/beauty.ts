import { geminiEnabled } from "@/infrastructure/ai/gemini";
import { objectId, PhotoAnalysis, Salon } from "@/infrastructure/db";
import { searchSalons } from "@/modules/catalog";
import { award } from "@/modules/loyalty";
import { diagnose, unusablePhoto, type BeautyMode, type Diagnosis, type Metrics } from "../domain/analysis";
import { visionDiagnose, type ServiceCandidate, type VisionLang } from "./vision";

const CATEGORIES: Record<BeautyMode, string[]> = { cheveux: ["coiffure"], visage: ["visage", "spa", "maquillage"] };
export type ProposedService = { name: string; salon: string; slug: string; service: string; price: number; reason?: string };

/** Prestations réelles des salons adaptés (catégories du mode), dans l'ordre de la recommandation (IA P1), 40 au plus */
async function serviceCandidates(userId: string | null, mode: BeautyMode): Promise<ServiceCandidate[]> {
  const salons = (await searchSalons({}, userId ?? undefined)).filter((s) => CATEGORIES[mode].includes(s.category));
  const docs = await Salon.find({ slug: { $in: salons.map((s) => s.slug) } }, { slug: 1, name: 1, services: 1 }).lean();
  return salons
    .flatMap((view) => {
      const doc = docs.find((d) => d.slug === view.slug);
      return (doc?.services ?? []).filter((s) => s.active).map((s) => ({ slug: doc!.slug, salon: doc!.name, service: s.key, name: s.name, price: s.price }));
    })
    .slice(0, 40);
}

/** Repli sans modèle : une prestation par terme de soin (dans l'ordre de la recommandation), sans doublon, 3 au plus */
function servicesByTerms(candidates: ServiceCandidate[], terms: string[]): ProposedService[] {
  const picked: ProposedService[] = [];
  for (const term of terms) {
    if (picked.length >= 3) break;
    const match = candidates.find((c) => c.name.toLowerCase().includes(term) && !picked.some((p) => p.slug === c.slug && p.service === c.service));
    if (match) picked.push({ ...match });
  }
  return picked;
}

/**
 * IA P5 : la photo est regardée par le modèle de vision (Gemini), qui juge aussi si elle est exploitable, décrit le profil,
 * les points forts, une routine et choisit les soins parmi les vraies prestations. Les mesures du navigateur écartent seulement
 * les photos inexploitables à coup sûr (sans appel au modèle) et servent de secours (règles) si le modèle est indisponible.
 * Pour une cliente connectée : résultat enregistré (sans la photo) et points crédités (1 fois par mois).
 */
export async function beautyAnalysis(userId: string | null, mode: BeautyMode, metrics: Metrics, opts: { image?: string; lang?: VisionLang } = {}) {
  const useVision = Boolean(opts.image) && geminiEnabled();
  const unusable = useVision ? unusablePhoto(metrics) : null;
  if (unusable) return unusable;
  const candidates = await serviceCandidates(userId, mode);
  let diagnosis: Diagnosis | null = null;
  let extras = { note: null as string | null, profile: [] as string[], strengths: [] as string[], routine: [] as string[] };
  let services: ProposedService[] = [];
  let source: "ai" | "rules" = "rules";
  if (useVision) {
    try {
      const vision = await visionDiagnose(mode, opts.image!, opts.lang ?? "fr", candidates);
      if (vision) {
        diagnosis = vision.diagnosis;
        extras = { note: vision.note || null, profile: vision.profile, strengths: vision.strengths, routine: vision.routine };
        services = vision.picks.map((p) => ({ ...p.candidate, reason: p.reason || undefined }));
        source = "ai";
      }
    } catch (error) {
      console.warn("[analyse beauté] modèle de vision indisponible, règles locales :", (error as Error).message);
    }
  }
  diagnosis ??= diagnose(mode, metrics);
  if (diagnosis.kind === "retake") return diagnosis;
  if (!services.length) services = servicesByTerms(candidates, diagnosis.terms);
  let points = 0;
  if (userId) {
    await PhotoAnalysis.create({ user: objectId(userId)!, mode, result: { score: diagnosis.score, issues: diagnosis.issues, metrics, source, ...extras } });
    points = await award(userId, "PHOTO_ANALYSIS", { label: mode === "cheveux" ? "Cheveux" : "Visage" });
  }
  return { ...diagnosis, ...extras, source, services, points, saved: Boolean(userId) };
}

export type BeautyResult = Awaited<ReturnType<typeof beautyAnalysis>>;
