import { PLAN_PRICES } from "@/core/domain/enums";

/**
 * Données de démonstration (seed). À remplacer par Prisma au fil des modules.
 * Les montants sont en dinars tunisiens (DT). Les dates sont au format ISO (AAAA-MM-JJ) et
 * formatées à l'affichage selon la langue. Les textes sont en français : ils sont traduits
 * à l'affichage via tc() (dictionnaire « content » de chaque langue).
 */

export const img = (id: string, w = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const IMAGES = {
  heroPortrait: img("photo-1630084775816-7abb7383ded5", 1400),
  heroSalon: img("photo-1675034741473-afed58a142e8", 900),
  heroNails: img("photo-1519014816548-bf5fe059798b", 700),
  proDashboard: img("photo-1746723378067-83a345ff3160", 1600),
  authSide: img("photo-1781450090585-1a511b7066d9", 1400),
  analysisSample: img("photo-1734111719430-fe4a3973f8af", 900),
};

export type CategoryId =
  | "coiffure"
  | "barbier"
  | "ongles"
  | "spa"
  | "maquillage"
  | "visage";

export const CATEGORIES: {
  id: CategoryId;
  label: string;
  count: number;
  image: string;
}[] = [
  { id: "coiffure", label: "Coiffure", count: 412, image: img("photo-1560869713-bf165a9cfac1", 800) },
  { id: "barbier", label: "Barbier", count: 186, image: img("photo-1503951914875-452162b0f3f1", 800) },
  { id: "ongles", label: "Ongles", count: 143, image: img("photo-1604902396830-aca29e19b067", 800) },
  { id: "spa", label: "Spa & massage", count: 97, image: img("photo-1600334089648-b0d9d3028eb2", 800) },
  { id: "maquillage", label: "Maquillage", count: 121, image: img("photo-1596704017254-9b121068fb31", 800) },
  { id: "visage", label: "Soins du visage", count: 88, image: img("photo-1598901986949-f593ff2a31a6", 800) },
];

export const CITIES = [
  { name: "Tunis", salons: 684 },
  { name: "La Marsa", salons: 142 },
  { name: "Sousse", salons: 231 },
  { name: "Sfax", salons: 198 },
  { name: "Nabeul", salons: 96 },
  { name: "Hammamet", salons: 88 },
  { name: "Monastir", salons: 74 },
  { name: "Bizerte", salons: 61 },
];

export type Affluence = "calme" | "moderee" | "forte";

export type Salon = {
  slug: string;
  name: string;
  category: CategoryId;
  specialties: string[];
  city: string;
  address: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  priceFrom: number;
  verified: boolean;
  affluence: Affluence;
  waitMinutes: number;
  nextSlots: string[];
  cover: string;
  gallery: string[];
  lat: number;
  lng: number;
  visited: boolean;
  offPeak?: string;
  aiReason: string;
  matchScore: number;
  topServices: { name: string; price: number; duration: number }[];
  /** Salon en favori pour l'utilisatrice connectée (fourni par l'API) */
  favorite?: boolean;
};

const INTERIORS = {
  a: img("photo-1626383137804-ff908d2753a2"),
  b: img("photo-1637777277435-3c44f82fd0c9"),
  c: img("photo-1781450090585-1a511b7066d9"),
  d: img("photo-1695527081848-1e46c06e6458"),
  e: img("photo-1763741141049-352dfafcc64f"),
  f: img("photo-1788985375145-81da8cc731a2"),
  g: img("photo-1773904215697-e6c21fc27ac2"),
  h: img("photo-1695527082039-5f96003b97e4"),
  i: img("photo-1626383120723-2a941488860d"),
  j: img("photo-1787651343620-8d5303006ecb"),
  k: img("photo-1786937680099-779e1da6f7f7"),
  l: img("photo-1746723378067-83a345ff3160"),
  m: img("photo-1695527081827-fdbc4e77be9b"),
  n: img("photo-1632345031435-8727f6897d53"),
  o: img("photo-1585747860715-2ba37e788b70"),
  p: img("photo-1600334129128-685c5582fd35"),
};

export const SALONS: Salon[] = [
  {
    slug: "salon-yasmine-la-marsa",
    name: "Salon Yasmine",
    category: "coiffure",
    specialties: ["Coiffure", "Couleur", "Mariée"],
    city: "La Marsa",
    address: "12 avenue Habib Bourguiba, La Marsa",
    distanceKm: 1.2,
    rating: 4.9,
    reviewCount: 238,
    priceFrom: 20,
    verified: true,
    affluence: "calme",
    waitMinutes: 5,
    nextSlots: ["10:30", "11:15", "14:00", "16:45"],
    cover: INTERIORS.c,
    gallery: [INTERIORS.c, INTERIORS.d, INTERIORS.h, INTERIORS.a, INTERIORS.k],
    lat: 36.8782,
    lng: 10.3247,
    visited: true,
    offPeak: "Mar. 10h–12h",
    aiReason: "Spécialiste des chignons de mariée, noté 4,9 par des clientes au profil proche du vôtre.",
    matchScore: 96,
    topServices: [
      { name: "Coupe + brushing", price: 35, duration: 45 },
      { name: "Balayage", price: 180, duration: 150 },
      { name: "Chignon de mariée", price: 120, duration: 90 },
    ],
  },
  {
    slug: "maison-elyssa-carthage",
    name: "Maison Elyssa",
    category: "visage",
    specialties: ["Soins visage", "Spa", "Épilation"],
    city: "Carthage",
    address: "4 rue Hannibal, Carthage Byrsa",
    distanceKm: 2.8,
    rating: 4.8,
    reviewCount: 176,
    priceFrom: 45,
    verified: true,
    affluence: "moderee",
    waitMinutes: 15,
    nextSlots: ["12:00", "15:30", "17:00"],
    cover: INTERIORS.k,
    gallery: [INTERIORS.k, INTERIORS.j, INTERIORS.p, INTERIORS.h, INTERIORS.m],
    lat: 36.8528,
    lng: 10.3233,
    visited: true,
    aiReason: "Recommandé après votre analyse photo : soins hydratants pour peau déshydratée.",
    matchScore: 91,
    topServices: [
      { name: "Soin hydratant profond", price: 60, duration: 50 },
      { name: "Hydrafacial", price: 140, duration: 60 },
      { name: "Épilation sourcils", price: 10, duration: 15 },
    ],
  },
  {
    slug: "nail-studio-menzah",
    name: "Nail Studio Menzah",
    category: "ongles",
    specialties: ["Manucure", "Semi-permanent", "Nail art"],
    city: "El Menzah",
    address: "27 rue de Marseille, El Menzah 6",
    distanceKm: 6.4,
    rating: 4.9,
    reviewCount: 98,
    priceFrom: 25,
    verified: true,
    affluence: "calme",
    waitMinutes: 0,
    nextSlots: ["09:30", "10:00", "13:30", "18:00"],
    cover: INTERIORS.n,
    gallery: [INTERIORS.n, INTERIORS.i, INTERIORS.e, INTERIORS.m, INTERIORS.h],
    lat: 36.844,
    lng: 10.18,
    visited: false,
    offPeak: "Lun. 9h–11h",
    aiReason: "Nouveau pour vous : +30 pts au premier rendez-vous, créneaux libres ce matin.",
    matchScore: 88,
    topServices: [
      { name: "Manucure semi-permanent", price: 35, duration: 45 },
      { name: "Pose gel", price: 60, duration: 75 },
      { name: "Beauté des pieds", price: 40, duration: 50 },
    ],
  },
  {
    slug: "barber-club-berges-du-lac",
    name: "Barber Club",
    category: "barbier",
    specialties: ["Barbier", "Coupe homme", "Rasage"],
    city: "Les Berges du Lac",
    address: "Immeuble Kiriat, rue du Lac Léman, Tunis",
    distanceKm: 4.1,
    rating: 4.7,
    reviewCount: 412,
    priceFrom: 15,
    verified: true,
    affluence: "forte",
    waitMinutes: 35,
    nextSlots: ["17:30", "18:15"],
    cover: INTERIORS.g,
    gallery: [INTERIORS.g, INTERIORS.o, INTERIORS.a, INTERIORS.l, INTERIORS.b],
    lat: 36.838,
    lng: 10.24,
    visited: false,
    aiReason: "Très demandé près de chez vous ; préférez 10h–12h pour éviter l'attente.",
    matchScore: 74,
    topServices: [
      { name: "Coupe homme", price: 15, duration: 30 },
      { name: "Taille de barbe", price: 10, duration: 20 },
      { name: "Rasage traditionnel", price: 20, duration: 30 },
    ],
  },
  {
    slug: "studio-noor-ennasr",
    name: "Studio Noor",
    category: "maquillage",
    specialties: ["Maquillage", "Sourcils", "Cils"],
    city: "Ennasr",
    address: "Avenue Hédi Nouira, Ennasr 2",
    distanceKm: 7.9,
    rating: 4.7,
    reviewCount: 64,
    priceFrom: 35,
    verified: false,
    affluence: "calme",
    waitMinutes: 0,
    nextSlots: ["11:00", "15:00"],
    cover: INTERIORS.f,
    gallery: [INTERIORS.f, INTERIORS.e, INTERIORS.i, INTERIORS.d, INTERIORS.h],
    lat: 36.862,
    lng: 10.165,
    visited: false,
    aiReason: "Maquillage événementiel à domicile possible pour votre mariage samedi.",
    matchScore: 81,
    topServices: [
      { name: "Maquillage soirée", price: 60, duration: 60 },
      { name: "Rehaussement de cils", price: 55, duration: 60 },
      { name: "Restructuration sourcils", price: 20, duration: 30 },
    ],
  },
  {
    slug: "atelier-beaute-sousse",
    name: "Atelier Beauté",
    category: "coiffure",
    specialties: ["Coiffure", "Maquillage", "Soins"],
    city: "Sousse",
    address: "Boulevard du 14 Janvier, Sousse",
    distanceKm: 142,
    rating: 4.6,
    reviewCount: 143,
    priceFrom: 30,
    verified: true,
    affluence: "moderee",
    waitMinutes: 10,
    nextSlots: ["10:00", "12:30", "16:00"],
    cover: INTERIORS.b,
    gallery: [INTERIORS.b, INTERIORS.a, INTERIORS.d, INTERIORS.e, INTERIORS.k],
    lat: 35.8256,
    lng: 10.636,
    visited: false,
    aiReason: "Salon populaire à Sousse, idéal pour vos séjours sur la côte.",
    matchScore: 70,
    topServices: [
      { name: "Coupe femme", price: 30, duration: 40 },
      { name: "Coloration", price: 80, duration: 90 },
      { name: "Maquillage jour", price: 40, duration: 45 },
    ],
  },
  {
    slug: "jasmin-spa-hammamet",
    name: "Jasmin Spa",
    category: "spa",
    specialties: ["Hammam", "Massage", "Gommage"],
    city: "Hammamet",
    address: "Route touristique, Yasmine Hammamet",
    distanceKm: 64,
    rating: 4.8,
    reviewCount: 321,
    priceFrom: 60,
    verified: true,
    affluence: "calme",
    waitMinutes: 0,
    nextSlots: ["11:30", "14:30", "16:00"],
    cover: INTERIORS.j,
    gallery: [INTERIORS.j, INTERIORS.p, INTERIORS.k, INTERIORS.h, INTERIORS.m],
    lat: 36.37,
    lng: 10.54,
    visited: true,
    offPeak: "Mer. 11h–14h",
    aiReason: "Vous avez adoré le hammam traditionnel en août : nouvelle formule duo disponible.",
    matchScore: 85,
    topServices: [
      { name: "Hammam + gommage", price: 60, duration: 60 },
      { name: "Massage relaxant", price: 90, duration: 60 },
      { name: "Rituel duo", price: 220, duration: 120 },
    ],
  },
  {
    slug: "adresse-coiffure-sfax",
    name: "L'Adresse Coiffure",
    category: "coiffure",
    specialties: ["Coiffure", "Kératine", "Couleur"],
    city: "Sfax",
    address: "Avenue Majida Boulila, Sfax",
    distanceKm: 268,
    rating: 4.5,
    reviewCount: 57,
    priceFrom: 20,
    verified: true,
    affluence: "moderee",
    waitMinutes: 10,
    nextSlots: ["09:00", "13:00"],
    cover: INTERIORS.d,
    gallery: [INTERIORS.d, INTERIORS.c, INTERIORS.a, INTERIORS.e, INTERIORS.h],
    lat: 34.7406,
    lng: 10.7603,
    visited: false,
    aiReason: "Spécialiste kératine, prix parmi les plus bas de la région.",
    matchScore: 66,
    topServices: [
      { name: "Brushing", price: 20, duration: 30 },
      { name: "Soin kératine", price: 130, duration: 120 },
      { name: "Couleur", price: 70, duration: 75 },
    ],
  },
];

export const getSalon = (slug: string) => SALONS.find((s) => s.slug === slug);

/* ---------- Détail salon ---------- */

export type Service = {
  id: string;
  name: string;
  description?: string;
  duration: number; // minutes
  price: number;
  oldPrice?: number;
  popular?: boolean;
};

export const SERVICE_GROUPS: { id: string; label: string; services: Service[] }[] = [
  {
    id: "forfaits",
    label: "Forfaits",
    services: [
      {
        id: "f-coupe-soin",
        name: "Coupe + soin hydratant",
        description: "Diagnostic, soin profond, coupe et brushing.",
        duration: 75,
        price: 65,
        oldPrice: 75,
      },
      {
        id: "f-mariee",
        name: "Mariée : essai + jour J",
        description: "Essai coiffure 3 semaines avant, coiffure le jour J, retouches incluses.",
        duration: 240,
        price: 320,
        popular: true,
      },
    ],
  },
  {
    id: "coupe",
    label: "Coupe & coiffage",
    services: [
      { id: "coupe-brushing", name: "Coupe femme + brushing", duration: 45, price: 35, popular: true },
      { id: "brushing", name: "Brushing", duration: 30, price: 20 },
      {
        id: "chignon",
        name: "Chignon de mariée",
        description: "Tenue longue durée, accessoires fournis.",
        duration: 90,
        price: 120,
      },
      { id: "coupe-enfant", name: "Coupe enfant (-12 ans)", duration: 30, price: 15 },
    ],
  },
  {
    id: "couleur",
    label: "Couleur",
    services: [
      { id: "racines", name: "Coloration racines", duration: 75, price: 70 },
      { id: "balayage", name: "Balayage", description: "Effet naturel soleil, patine incluse.", duration: 150, price: 180, popular: true },
      { id: "gloss", name: "Gloss / patine", duration: 45, price: 45 },
    ],
  },
  {
    id: "soins",
    label: "Soins capillaires",
    services: [
      { id: "keratine", name: "Soin kératine", duration: 120, price: 150 },
      { id: "hydratant", name: "Soin hydratant profond", duration: 40, price: 40 },
    ],
  },
];

export const ALL_SERVICES = SERVICE_GROUPS.flatMap((g) => g.services);

/** Date ISO du jour de la semaine (0 = dimanche … 6 = samedi), pour en formater le nom */
export const weekdayIso = (weekday: number) => new Date(Date.UTC(2026, 8, 27 + weekday)).toISOString().slice(0, 10);

export type Employee = {
  id: string;
  name: string;
  role: string;
  rating: number;
  avatar?: string;
  /** index 1–5 de la palette catégorielle (ordre fixe) */
  color: 1 | 2 | 3 | 4 | 5;
};

export const EMPLOYEES: Employee[] = [
  { id: "amira", name: "Amira", role: "Coloriste senior", rating: 4.9, avatar: img("photo-1580489944761-15a19d654956", 300), color: 1 },
  { id: "nour", name: "Nour", role: "Coiffeuse · chignons", rating: 4.9, avatar: img("photo-1489278353717-f64c6ee8a4d2", 300), color: 2 },
  { id: "ines", name: "Ines", role: "Coiffeuse", rating: 4.8, avatar: img("photo-1662850886700-4ec19bd30d11", 300), color: 3 },
  { id: "sami", name: "Sami", role: "Coiffeur · barbier", rating: 4.7, color: 4 },
];

/** weekday : 0 = dimanche … 6 = samedi ; hours null = fermé */
export const OPENING_HOURS: { weekday: number; hours: string | null }[] = [
  { weekday: 1, hours: "09:00 – 19:00" },
  { weekday: 2, hours: "09:00 – 19:00" },
  { weekday: 3, hours: "09:00 – 19:00" },
  { weekday: 4, hours: "09:00 – 20:00" },
  { weekday: 5, hours: "09:00 – 20:00" },
  { weekday: 6, hours: "08:30 – 20:00" },
  { weekday: 0, hours: null },
];

/** Prévision d'affluence du jour (0–100) — IA Personne 2 */
export const TODAY_FORECAST = [
  { hour: 9, value: 22 },
  { hour: 10, value: 18 },
  { hour: 11, value: 30 },
  { hour: 12, value: 45 },
  { hour: 13, value: 38 },
  { hour: 14, value: 52 },
  { hour: 15, value: 71 },
  { hour: 16, value: 84 },
  { hour: 17, value: 90 },
  { hour: 18, value: 76 },
  { hour: 19, value: 40 },
];

export type Review = {
  id: string;
  author: string;
  avatar?: string;
  date: string;
  rating: number;
  service: string;
  employee: string;
  /** Texte laissé par la cliente : affiché dans sa langue d'origine */
  text: string;
  photo?: string;
  reply?: string;
  helpful: number;
};

export const REVIEWS: Review[] = [
  {
    id: "r1",
    author: "Meriem K.",
    avatar: img("photo-1567516364473-233c4b6fcfbe", 200),
    date: "2026-09-21",
    rating: 5,
    service: "Chignon de mariée",
    employee: "Nour",
    text: "Chignon parfait pour le mariage de ma sœur, il a tenu jusqu'à 3h du matin. Nour a pris le temps de comprendre ce que je voulais, et l'essai trois semaines avant m'a vraiment rassurée.",
    photo: img("photo-1734111719430-fe4a3973f8af", 600),
    reply: "Merci Meriem ! C'était un plaisir de vous accompagner. À très bientôt.",
    helpful: 18,
  },
  {
    id: "r2",
    author: "Salma B.",
    avatar: img("photo-1534180477871-5d6cc81f3920", 200),
    date: "2026-09-14",
    rating: 5,
    service: "Balayage",
    employee: "Amira",
    text: "Balayage très naturel, exactement la nuance demandée. Ponctuelle, salon impeccable. Seul bémol : difficile de se garer le samedi.",
    helpful: 11,
  },
  {
    id: "r3",
    author: "Yosra M.",
    date: "2026-09-02",
    rating: 4,
    service: "Coupe femme + brushing",
    employee: "Ines",
    text: "Très bonne coupe. J'ai attendu une quinzaine de minutes un samedi après-midi, mais l'équipe m'a prévenue par notification.",
    helpful: 6,
  },
  {
    id: "r4",
    author: "Hela T.",
    avatar: img("photo-1562337404-3044c84ac061", 200),
    date: "2026-08-28",
    rating: 5,
    service: "Soin kératine",
    employee: "Amira",
    text: "Cheveux transformés, brillants et disciplinés depuis trois semaines. Conseils très utiles pour l'entretien à la maison.",
    helpful: 9,
  },
];

export const REVIEW_SUMMARY = {
  sentiment: { positif: 86, neutre: 10, negatif: 4 },
  strengths: ["Chignons qui tiennent toute la journée", "Accueil chaleureux", "Grande ponctualité"],
  weaknesses: ["Attente le samedi après-midi", "Stationnement difficile"],
  summary:
    "Les clientes saluent surtout la tenue des coiffures de mariée et le conseil personnalisé. Les rares remarques négatives concernent l'attente le samedi et le parking.",
  distribution: [
    { stars: 5, count: 201 },
    { stars: 4, count: 27 },
    { stars: 3, count: 6 },
    { stars: 2, count: 3 },
    { stars: 1, count: 1 },
  ],
};

export const AMENITIES = ["Wi-Fi", "Paiement par carte", "Accès PMR", "Boissons offertes", "Climatisation"];

/* ---------- Espace client ---------- */

export const CLIENT = {
  firstName: "Sarra",
  lastName: "Ben Ali",
  email: "sarra.benali@exemple.tn",
  avatar: img("photo-1489278353717-f64c6ee8a4d2", 300),
  city: "La Marsa",
  memberSince: "2025-03-01",
  points: 420, // solde échangeable
  lifetimePoints: 640, // cumul → niveau
  salonsVisited: 6,
  referralCode: "SARRA-50",
};

export type TierId = "bronze" | "argent" | "or" | "platine";

export const TIERS: {
  id: TierId;
  label: string;
  min: number;
  max: number | null;
  perks: string[];
}[] = [
  { id: "bronze", label: "Bronze", min: 0, max: 199, perks: ["Accès de base"] },
  { id: "argent", label: "Argent", min: 200, max: 499, perks: ["+10 % de points sur chaque action", "Offres exclusives"] },
  { id: "or", label: "Or", min: 500, max: 999, perks: ["+20 % de points", "Réservation prioritaire", "Annulation gratuite plus tardive"] },
  { id: "platine", label: "Platine", min: 1000, max: null, perks: ["+30 % de points", "Cadeaux mensuels", "Offres VIP", "Support prioritaire"] },
];

export const tierFor = (points: number) =>
  [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];

export const EARN_RULES = [
  { action: "Rendez-vous terminé", points: "+10", note: "Après confirmation du salon" },
  { action: "Premier RDV dans un nouveau salon", points: "+30", note: "Salon jamais visité" },
  { action: "Palier de salons visités", points: "+50", note: "À 3, 5 puis 10 salons" },
  { action: "Avis vérifié publié", points: "+15", note: "+10 avec photo" },
  { action: "Parrainage d'un ami", points: "+50", note: "Pour chacun" },
  { action: "Réservation en heure creuse", points: "+10", note: "Selon la prédiction d'affluence" },
  { action: "Analyse beauté par photo", points: "+10", note: "1 fois par mois" },
  { action: "Série mensuelle", points: "+25", note: "3 mois consécutifs" },
];

export const REWARDS = [
  { id: "prio", label: "Réservation prioritaire sur un créneau très demandé", cost: 50 },
  { id: "5dt", label: "Réduction de 5 DT sur un rendez-vous", cost: 100 },
  { id: "15p", label: "Réduction de 15 % sur un service", cost: 200 },
  { id: "gift", label: "Cadeau produit d'un salon partenaire", cost: 300 },
  { id: "free", label: "Service offert (ex. soin express)", cost: 400 },
];

export type PointEvent = "done" | "newSalon" | "analysis" | "reviewPhoto" | "redeem" | "referral" | "offPeak";

export const POINT_HISTORY: { date: string; type: PointEvent; who?: string; points: number }[] = [
  { date: "2026-09-12", type: "done", who: "Maison Elyssa", points: 10 },
  { date: "2026-09-12", type: "newSalon", who: "Maison Elyssa", points: 30 },
  { date: "2026-09-05", type: "analysis", points: 10 },
  { date: "2026-08-24", type: "reviewPhoto", who: "Salon Yasmine", points: 25 },
  { date: "2026-08-20", type: "redeem", points: -200 },
  { date: "2026-08-02", type: "referral", who: "Leila", points: 50 },
  { date: "2026-08-02", type: "offPeak", who: "Jasmin Spa", points: 10 },
];

export const BADGES = [
  { id: "explorateur", label: "Explorateur", goal: "5 salons différents", progress: 6, target: 5 },
  { id: "ponctuel", label: "Ponctuel", goal: "10 RDV sans retard", progress: 10, target: 10 },
  { id: "fidele", label: "Fidèle", goal: "10 RDV chez un salon", progress: 7, target: 10 },
  { id: "critique", label: "Critique utile", goal: "10 avis", progress: 6, target: 10 },
  { id: "ambassadeur", label: "Ambassadeur", goal: "3 parrainages", progress: 1, target: 3 },
];

export type BookingStatus = "confirme" | "termine" | "annule" | "en_attente";

export const CLIENT_BOOKINGS: {
  id: string;
  salonSlug: string;
  service: string;
  employee: string;
  date: string;
  time: string;
  price: number;
  deposit?: number;
  status: BookingStatus;
  reviewed?: boolean;
}[] = [
  { id: "b1", salonSlug: "salon-yasmine-la-marsa", service: "Balayage", employee: "Amira", date: "2026-10-03", time: "14:00", price: 180, deposit: 30, status: "confirme" },
  { id: "b2", salonSlug: "nail-studio-menzah", service: "Manucure semi-permanent", employee: "Rym", date: "2026-10-13", time: "11:00", price: 35, status: "en_attente" },
  { id: "b3", salonSlug: "maison-elyssa-carthage", service: "Soin hydratant profond", employee: "Dorra", date: "2026-09-12", time: "10:30", price: 60, status: "termine", reviewed: false },
  { id: "b4", salonSlug: "salon-yasmine-la-marsa", service: "Coupe femme + brushing", employee: "Ines", date: "2026-08-22", time: "15:00", price: 35, status: "termine", reviewed: true },
  { id: "b5", salonSlug: "jasmin-spa-hammamet", service: "Hammam + gommage", employee: "Afef", date: "2026-08-02", time: "11:30", price: 60, status: "termine", reviewed: true },
  { id: "b6", salonSlug: "atelier-beaute-sousse", service: "Maquillage jour", employee: "Olfa", date: "2026-07-10", time: "17:00", price: 40, status: "annule" },
];

export const FAVORITES = ["salon-yasmine-la-marsa", "jasmin-spa-hammamet", "nail-studio-menzah", "maison-elyssa-carthage"];

/* ---------- Dashboard salon ---------- */

export const SALON_TODAY = [
  { time: "09:00", end: "10:15", client: "Rania H.", service: "Coloration racines", employee: "amira", status: "termine", price: 70 },
  { time: "09:30", end: "10:15", client: "Leila S.", service: "Coupe + brushing", employee: "ines", status: "termine", price: 35 },
  { time: "10:00", end: "11:30", client: "Mouna G.", service: "Chignon de mariée", employee: "nour", status: "en_cours", price: 120 },
  { time: "10:30", end: "11:00", client: "Karim D.", service: "Coupe homme", employee: "sami", status: "en_cours", price: 15 },
  { time: "11:30", end: "14:00", client: "Sarra B.", service: "Balayage", employee: "amira", status: "confirme", price: 180 },
  { time: "12:00", end: "12:40", client: "Nadia F.", service: "Soin hydratant", employee: "ines", status: "confirme", price: 40 },
  { time: "14:00", end: "14:30", client: "Walid A.", service: "Taille de barbe", employee: "sami", status: "confirme", price: 10 },
  { time: "14:30", end: "15:15", client: "Asma R.", service: "Coupe + brushing", employee: "nour", status: "confirme", price: 35 },
  { time: "15:00", end: "17:00", client: "Emna Z.", service: "Soin kératine", employee: "ines", status: "confirme", price: 150 },
  { time: "15:30", end: "16:15", client: "Olfa K.", service: "Gloss", employee: "amira", status: "confirme", price: 45 },
  { time: "16:00", end: "16:30", client: "Hedi M.", service: "Coupe homme", employee: "sami", status: "absent", price: 15 },
  { time: "16:30", end: "17:15", client: "Ines J.", service: "Coupe + brushing", employee: "nour", status: "confirme", price: 35 },
  { time: "17:30", end: "18:00", client: "Youssef T.", service: "Coupe homme", employee: "sami", status: "confirme", price: 15 },
  { time: "17:30", end: "18:15", client: "Sonia L.", service: "Coupe + brushing", employee: "amira", status: "confirme", price: 35 },
] as const;

/** Blocages de l'agenda (pauses, congés) */
export const SALON_BLOCKS = [
  { employee: "amira", time: "14:00", end: "14:30", label: "Pause" },
  { employee: "nour", time: "12:30", end: "13:30", label: "Pause déjeuner" },
  { employee: "ines", time: "13:00", end: "14:00", label: "Pause déjeuner" },
  { employee: "sami", time: "11:00", end: "13:30", label: "Formation" },
];

/** Jours (1 = lundi … 6 = samedi) et heures de la prévision d'affluence */
export const HEATMAP_DAYS = [1, 2, 3, 4, 5, 6];
export const HEATMAP_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/** Taux d'occupation prévu (0–100) par jour × heure — IA prédiction d'affluence */
export const AFFLUENCE_FORECAST: number[][] = [
  [20, 18, 30, 44, 36, 50, 68, 80, 88, 74, 38],
  [12, 10, 16, 30, 28, 34, 46, 58, 66, 54, 26],
  [18, 22, 28, 40, 34, 42, 56, 70, 76, 62, 30],
  [24, 28, 36, 50, 42, 54, 70, 82, 90, 84, 52],
  [30, 34, 44, 58, 50, 64, 80, 92, 96, 90, 64],
  [58, 72, 84, 90, 82, 94, 98, 99, 96, 86, 60],
];

export const RECENT_REVIEWS_SALON = [
  { author: "Meriem K.", rating: 5, text: "Chignon parfait, il a tenu toute la nuit.", sentiment: "positif", suspicion: 3 },
  { author: "Yosra M.", rating: 4, text: "Très bonne coupe, un peu d'attente le samedi.", sentiment: "neutre", suspicion: 6 },
  { author: "compte_8812", rating: 1, text: "Nul nul nul, à éviter absolument !!!", sentiment: "negatif", suspicion: 87 },
] as const;

/* ---------- Super Admin ---------- */

export const ADMIN_KPIS = {
  salons: 1342,
  salonsDelta: 4.8,
  clients: 18420,
  clientsDelta: 9.1,
  bookings30d: 12860,
  bookingsDelta: 12.4,
  revenue30d: 48200,
  revenueDelta: 7.6,
};


export type PlanId = "gratuit" | "pro" | "premium";

export const PENDING_SALONS: {
  id: string;
  name: string;
  owner: string;
  city: string;
  category: string;
  plan: PlanId;
  hoursAgo: number;
  document: string;
}[] = [
  { id: "p1", name: "Beauty Lounge Menzah 9", owner: "Hajer Trabelsi", city: "Tunis", category: "Coiffure", plan: "pro", hoursAgo: 2, document: "Registre de commerce.pdf" },
  { id: "p2", name: "Zen Hammam Monastir", owner: "Fathi Guesmi", city: "Monastir", category: "Spa", plan: "premium", hoursAgo: 5, document: "Patente 2026.pdf" },
  { id: "p3", name: "Nails by Rim", owner: "Rim Chaouachi", city: "Nabeul", category: "Ongles", plan: "gratuit", hoursAgo: 26, document: "Carte d'identité fiscale.pdf" },
  { id: "p4", name: "Gentleman Barber Sfax", owner: "Aymen Kallel", city: "Sfax", category: "Barbier", plan: "pro", hoursAgo: 30, document: "Registre de commerce.pdf" },
];

export const FLAGGED_REVIEWS = [
  {
    id: "f1",
    salon: "Salon Yasmine",
    author: "compte_8812",
    rating: 1,
    text: "Nul nul nul, à éviter absolument !!!",
    score: 87,
    reasons: ["Compte créé il y a 2 jours", "Aucun RDV terminé associé"],
    reportedBy: "salon",
  },
  {
    id: "f2",
    salon: "Barber Club",
    author: "Mehdi R.",
    rating: 5,
    text: "Meilleur barbier de Tunis, service incroyable, je recommande à 100 %.",
    score: 72,
    reasons: ["Texte identique à 92 % à 3 autres avis", "5 avis en 1 heure"],
    reportedBy: "ai",
  },
  {
    id: "f3",
    salon: "Jasmin Spa",
    author: "Amel S.",
    rating: 2,
    text: "Hammam trop chaud et personnel pressé ce jour-là.",
    score: 18,
    reasons: ["Signalé par le salon"],
    reportedBy: "salon",
  },
] as const;

export const PLAN_SPLIT: { plan: PlanId; salons: number }[] = [
  { plan: "gratuit", salons: 764 },
  { plan: "pro", salons: 441 },
  { plan: "premium", salons: 137 },
];

/** Journal d'audit récent (Super Admin) */
export const ADMIN_AUDIT = [
  { who: "Amine", role: "admin", action: "suspend", target: "Glam Studio Ariana", minutesAgo: 12 },
  { who: "Sarra", role: "moderator", action: "hideReviews", target: "Barber Club", minutesAgo: 64 },
  { who: "Amine", role: "admin", action: "campaign", target: "", minutesAgo: 1500 },
  { who: "", role: "system", action: "expire", target: "", minutesAgo: 1620 },
] as const;


export const PLANS: { id: PlanId; name: string; price: number; audience: string; highlighted?: boolean; features: string[] }[] = [
  {
    id: "gratuit",
    name: "Gratuit",
    price: 0,
    audience: "Petit salon qui débute",
    features: ["Profil salon & photos", "Réservation en ligne de base", "1 employé", "Avis vérifiés"],
  },
  {
    id: "pro",
    name: "Pro",
    price: PLAN_PRICES.pro,
    audience: "Salon actif",
    highlighted: true,
    features: [
      "Agenda complet jour / semaine / mois",
      "Jusqu'à 8 employés",
      "Mini-CRM & notes clients",
      "Statistiques & export PDF / Excel",
      "Promotions et codes promo",
      "Prédiction d'affluence IA",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: PLAN_PRICES.premium,
    audience: "Grand centre",
    features: [
      "Employés illimités",
      "Gestion des stocks",
      "Plusieurs succursales",
      "Rapports avancés",
      "Mise en avant dans la recherche",
      "Support prioritaire",
    ],
  },
];
