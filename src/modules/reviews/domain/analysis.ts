/**
 * IA P4 — analyse des avis, sans service externe (fonctions pures, testées).
 * Sentiment : lexique français / anglais / arabe (dont darija courante) avec négations et emojis,
 * combiné à la note ; repli sur la note seule quand le texte ne contient aucun indice.
 * Aspects : accueil, résultat, attente, prix, propreté, conseil, ponctualité, chacun positif ou négatif.
 * Suspicion (0–100) : indices de faux avis pour la modération (texte creux, note incohérente, liens…).
 */

export const ASPECTS = ["accueil", "resultat", "attente", "prix", "proprete", "conseil", "ponctualite"] as const;
export type Aspect = (typeof ASPECTS)[number];
export type Sentiment = "positif" | "neutre" | "negatif";
export type ReviewAnalysis = { sentiment: Sentiment; score: number; aspects: { aspect: Aspect; polarity: 1 | -1 }[]; suspicion: number; source: "lexicon" | "rating" };

const ASPECT_WORDS: Record<Aspect, string[]> = {
  accueil: ["accueil", "accueillant", "accueillante", "gentil", "gentille", "aimable", "sympa", "chaleureux", "chaleureuse", "souriant", "souriante", "équipe", "welcome", "welcoming", "friendly", "kind", "staff", "ترحيب", "استقبال", "لطيف", "لطيفة", "الفريق"],
  resultat: ["résultat", "coupe", "couleur", "coloration", "coiffure", "brushing", "chignon", "balayage", "manucure", "ongles", "soin", "tient", "tenue", "rendu", "result", "cut", "color", "colour", "hair", "nails", "نتيجة", "قصة", "لون", "تسريحة"],
  attente: ["attente", "attendre", "attendu", "attendue", "patienté", "wait", "waited", "waiting", "queue", "انتظار", "استنيت", "انتظرت"],
  prix: ["prix", "cher", "chère", "chers", "tarif", "tarifs", "abordable", "price", "prices", "expensive", "cheap", "affordable", "سعر", "الأسعار", "غالي", "غالية", "رخيص"],
  proprete: ["propre", "propreté", "sale", "hygiène", "clean", "dirty", "hygiene", "نظيف", "نظيفة", "نظافة", "وسخ"],
  conseil: ["conseil", "conseils", "conseillé", "conseillée", "écoute", "advice", "advised", "listened", "listen", "نصيحة", "نصائح", "نصحتني"],
  ponctualite: ["ponctuel", "ponctuelle", "ponctualité", "à l'heure", "à l’heure", "retard", "punctual", "late", "on time", "delay", "الوقت", "تأخير", "متأخر"],
};

const POSITIVE = [
  "excellent", "excellente", "parfait", "parfaite", "super", "top", "génial", "géniale", "magnifique", "ravie", "ravi", "adore", "adoré", "recommande", "bravo", "merci", "rapide", "professionnel", "professionnelle", "satisfaite", "satisfait", "impeccable", "propre", "agréable", "doux", "douce", "belle", "beau", "sublime", "nickel", "abordable", "ponctuel", "ponctuelle", "chaleureux", "chaleureuse", "aimable", "gentille", "gentil", "tient",
  "great", "amazing", "love", "loved", "perfect", "recommend", "excellent", "friendly", "clean", "beautiful", "best", "happy", "nice", "good", "punctual", "affordable",
  "رائع", "رائعة", "ممتاز", "ممتازة", "شكرا", "أنصح", "نظيف", "نظيفة", "جميل", "جميلة", "مزيان", "باهي", "بهي", "يعطيك", "برافو", "تحفة", "لطيفة", "لطيف",
];
const NEGATIVE = [
  "déçue", "déçu", "décevant", "décevante", "nul", "nulle", "horrible", "sale", "cher", "chère", "long", "longue", "retard", "raté", "ratée", "mal", "impoli", "impolie", "désagréable", "brûlé", "abîmé", "abîmés", "catastrophe", "lent", "lente", "bâclé", "bâclée", "attendre", "pire", "dommage", "problème",
  "bad", "terrible", "disappointed", "rude", "late", "dirty", "expensive", "awful", "worst", "slow", "ruined", "never", "problem",
  "سيء", "سيئة", "غالي", "غالية", "تأخير", "متأخر", "خايب", "ماعجبنيش", "وسخ", "مشكل", "خسارة",
];
/** « t » : fin des contractions anglaises (don't, didn't, isn't…) après découpage sur l'apostrophe */
const NEGATIONS = ["pas", "jamais", "aucun", "aucune", "sans", "not", "no", "never", "t", "ما", "لا", "مش", "موش", "ليس"];
const POSITIVE_EMOJI = /[😍🥰😊🙂👍❤💕💖✨🌸👌💯🤩]/u;
const NEGATIVE_EMOJI = /[😡😠👎😞😔💔🤬😤]/u;

/** Mots en minuscules ; l'apostrophe sépare (« d'attente » → « d », « attente » ; « didn't » → « didn », « t ») */
const tokenize = (text: string) => text.toLowerCase().normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const sentences = (text: string) => text.split(/[.!?؟\n]+/).map((s) => s.trim()).filter(Boolean);
const has = (list: string[], token: string) => list.includes(token);

/** Polarité d'un passage : +1 par mot positif, −1 par mot négatif, inversée après une négation (3 mots) */
function polarity(text: string) {
  const tokens = tokenize(text);
  let score = 0;
  let hits = 0;
  let negate = 0;
  for (const token of tokens) {
    if (has(NEGATIONS, token)) {
      negate = 3;
      continue;
    }
    const value = has(POSITIVE, token) ? 1 : has(NEGATIVE, token) ? -1 : 0;
    if (value) {
      score += negate > 0 ? -value : value;
      hits += 1;
    }
    negate = Math.max(0, negate - 1);
  }
  for (const char of text) {
    if (POSITIVE_EMOJI.test(char)) {
      score += 1;
      hits += 1;
    } else if (NEGATIVE_EMOJI.test(char)) {
      score -= 1;
      hits += 1;
    }
  }
  return { score, hits };
}

const ratingScore = (rating: number) => (rating - 3) / 2; // 1 → −1, 3 → 0, 5 → +1
const toSentiment = (score: number): Sentiment => (score > 0.25 ? "positif" : score < -0.2 ? "negatif" : "neutre");

function suspicionOf(text: string, rating: number, lexical: number, hits: number) {
  let s = 0;
  const words = tokenize(text);
  if (words.length < 4) s += 30; // avis creux
  if (/https?:\/\/|www\.|\.com\b/i.test(text)) s += 35; // lien publicitaire
  if (/(.)\1{4,}/u.test(text)) s += 15; // « suuuuuper », « !!!!!! »
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length > 12 && letters === letters.toUpperCase() && /[A-Z]/.test(letters)) s += 15; // tout en majuscules
  if (hits > 0 && ((rating >= 4 && lexical < -0.3) || (rating <= 2 && lexical > 0.3))) s += 30; // note contredite par le texte
  if (new Set(words).size < words.length / 2 && words.length > 6) s += 15; // répétitions
  return Math.min(100, s);
}

export function analyzeReview(input: { text: string; rating: number }): ReviewAnalysis {
  const { score, hits } = polarity(input.text);
  const lexical = hits ? Math.max(-1, Math.min(1, score / Math.max(2, hits))) : 0;
  const combined = hits ? 0.6 * lexical + 0.4 * ratingScore(input.rating) : ratingScore(input.rating);

  const aspects: ReviewAnalysis["aspects"] = [];
  for (const sentence of sentences(input.text)) {
    const lower = sentence.toLowerCase();
    const tokens = tokenize(sentence);
    const p = polarity(sentence);
    const sign: 1 | -1 | 0 = p.score > 0 ? 1 : p.score < 0 ? -1 : input.rating >= 4 ? 1 : input.rating <= 2 ? -1 : 0;
    if (!sign) continue;
    for (const aspect of ASPECTS) {
      if (aspects.some((a) => a.aspect === aspect)) continue;
      if (ASPECT_WORDS[aspect].some((w) => (w.includes(" ") ? lower.includes(w) : tokens.includes(w)))) aspects.push({ aspect, polarity: sign });
    }
  }
  return { sentiment: toSentiment(combined), score: Math.round(combined * 100) / 100, aspects, suspicion: suspicionOf(input.text, input.rating, lexical, hits), source: hits ? "lexicon" : "rating" };
}

/** Synthèse d'un salon : répartition des sentiments, points forts et points à améliorer (aspects) */
export function summarizeReviews(analyses: { sentiment: string | null; aspects: { aspect: string; polarity: number }[] }[]) {
  const analysed = analyses.filter((a) => a.sentiment);
  const share = (s: Sentiment) => (analysed.length ? Math.round((analysed.filter((a) => a.sentiment === s).length / analysed.length) * 100) : 0);
  const tally = new Map<Aspect, { pos: number; neg: number }>();
  for (const a of analyses) {
    for (const x of a.aspects) {
      const aspect = x.aspect as Aspect;
      const t = tally.get(aspect) ?? { pos: 0, neg: 0 };
      tally.set(aspect, x.polarity > 0 ? { ...t, pos: t.pos + 1 } : { ...t, neg: t.neg + 1 });
    }
  }
  const rows = [...tally.entries()].map(([aspect, t]) => ({ aspect, ...t }));
  return {
    analysed: analysed.length,
    sentiment: { positif: share("positif"), neutre: share("neutre"), negatif: share("negatif") },
    strengths: rows.filter((r) => r.pos >= 2 && r.pos > r.neg * 2).sort((a, b) => b.pos - a.pos).slice(0, 3).map((r) => r.aspect),
    weaknesses: rows.filter((r) => r.neg >= 1 && r.neg >= r.pos / 3).sort((a, b) => b.neg - a.neg).slice(0, 2).map((r) => r.aspect),
  };
}
