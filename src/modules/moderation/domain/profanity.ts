/**
 * Gros mots — règles pures, sans service externe (premier filtre, toujours actif, et repli quand l'IA est indisponible).
 * Français, anglais, arabe et derja tunisienne, en écriture arabe comme en arabizi (3 = ع, 7 = ح, 9 = ق, 5 = خ).
 * Tolère les majuscules, accents, signes diacritiques arabes, lettres étirées (« zebiiii »), chiffres « leet » (« sh1t »)
 * et préfixes / suffixes arabes collés (« ياقحبة », « زبي »).
 */

/** Mots interdits, comparés au mot entier après normalisation */
const WORDS = [
  // français
  "merde", "merdique", "putain", "pute", "putes", "salope", "salopes", "salaud", "salauds", "connard", "connards", "connasse", "con", "conne",
  "encule", "encules", "enculer", "nique", "niquer", "niquez", "ntm", "fdp", "batard", "batards", "pd", "pede", "abruti", "abrutie", "chienne",
  "enfoire", "enfoiree", "emmerde", "emmerder", "couille", "couilles", "bite", "branleur", "pouffiasse", "petasse", "garce",
  // anglais
  "shit", "shitty", "bullshit", "asshole", "bastard", "dick", "dickhead", "cunt", "whore", "slut", "wtf", "stfu",
  // derja tunisienne en arabizi
  "zebi", "zeby", "zebbi", "zab", "zebb", "zok", "zokk", "nayek", "nik", "nikk", "nikomek", "nikmok", "kahba", "qahba", "miboun", "mibouna",
  "zamel", "zemla", "tahan", "ta7an", "khra", "5ra", "kharya", "5arya", "3asba", "asba", "terma", "tirma", "sorm", "9lewi", "9lawi", "klawi",
  "bhim", "hmar", "7mar", "kos", "koss", "manyouk", "manyak", "mnayek", "na3al", "n3al",
  // arabe et derja tunisienne en écriture arabe
  "زبي", "زبك", "زب", "زبور", "زك", "زكمك", "كسك", "نيك", "نيكمك", "ناك", "نايك", "قحبة", "قحاب", "ميبون", "ميبونة", "زامل", "طحان", "خرا", "خراء",
  "ترمة", "صرم", "قلاوي", "كس", "كسمك", "كسامك", "شرموطة", "متناك", "منيوك", "منايك", "بهيم", "حمار", "نعل", "يلعن",
];

/** Débuts de mots sans ambiguïté (« fucking », « 9a7ba », « قحبة ») — jamais un début qui ouvre aussi un mot courant */
const STEMS = [
  "fuck", "motherf", "bitch", "connar", "connas", "encul", "9a7b", "9ahb", "9o7b", "kahb", "qahb", "charmout", "sharmout", "manyou", "nikom", "nikmo",
  "zokom", "kosom", "miboun", "metnak",
  "قحب", "شرموط", "منيوك", "متناك", "ميبون", "نيكم",
];

const ARABIC = /[؀-ۿ]/;
const ARABIC_PREFIXES = ["وال", "ال", "يا", "و", "ف", "ب", "ل"];
const ARABIC_SUFFIXES = ["كم", "مك", "ها", "هم", "ات", "ك", "ي", "ه"];
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

/** Minuscules, sans accents ni signes diacritiques arabes (أ إ آ → ا), ى → ي, ة → ه, lettres étirées ramenées à une seule */
export function normalizeWord(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .normalize("NFC")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/(.)\1{2,}/gu, "$1");
}

const WORD_SET = new Set(WORDS.map(normalizeWord));
const STEM_LIST = STEMS.map(normalizeWord);

/** Formes à comparer : le mot, sa lecture « leet » et, en arabe, le mot sans préfixe ni suffixe collé */
function candidates(word: string) {
  const base = normalizeWord(word);
  const forms = new Set([base, base.replace(/[013457@$]/g, (c) => LEET[c])]);
  if (ARABIC.test(base)) {
    const strip = (w: string, affixes: string[], atStart: boolean) =>
      affixes.filter((a) => w.length - a.length >= 3 && (atStart ? w.startsWith(a) : w.endsWith(a))).map((a) => (atStart ? w.slice(a.length) : w.slice(0, -a.length)));
    for (const w of [base, ...strip(base, ARABIC_PREFIXES, true)]) {
      forms.add(w);
      for (const s of strip(w, ARABIC_SUFFIXES, false)) forms.add(s);
    }
  }
  return [...forms];
}

export const isProfane = (word: string) => candidates(word).some((c) => WORD_SET.has(c) || STEM_LIST.some((s) => c.startsWith(s)));

/** Mots du texte (lettres, chiffres de l'arabizi, @ et $ du « leet »), avec leur position */
const WORD = /[\p{L}\p{M}\p{N}@$]+/gu;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remplace chaque gros mot par des « * » (même longueur). `extra` : mots ou expressions repérés par l'IA,
 * masqués seulement là où ils forment des mots entiers (« con » ne touche jamais « conseil »).
 */
export function maskProfanity(text: string, extra: string[] = []) {
  const ranges: [number, number][] = [];
  for (const m of text.matchAll(WORD)) if (isProfane(m[0])) ranges.push([m.index, m.index + m[0].length]);
  for (const phrase of extra.map((p) => p.trim()).filter((p) => p.length >= 2 && p.length <= 40)) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "giu");
    for (const m of text.matchAll(pattern)) ranges.push([m.index, m.index + m[0].length]);
  }
  if (!ranges.length) return { text, masked: 0 };
  ranges.sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    out += text.slice(cursor, from) + text.slice(from, end).replace(/[^\s]/gu, "*");
    cursor = end;
  }
  return { text: out + text.slice(cursor), masked: ranges.length };
}
