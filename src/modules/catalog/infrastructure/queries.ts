import { cache } from "react";
import type { Category } from "@/core/domain/enums";
import { slugify } from "@/core/domain/text";
import { tunisToday, utcToTunis } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Review, Salon, User, type SalonDoc } from "@/infrastructure/db";
import { getSalon as getMockSalon, type CategoryId, type Salon as SalonView } from "@/lib/data";
import { getAvailability } from "@/modules/booking";

/**
 * Lecture des salons pour l'interface (P3, RES-01 et RES-02).
 * Renvoie le type `Salon` déjà utilisé par les composants : les pages passent de la démo à la base sans changer d'UI.
 *
 * Champs produits par les IA, pas encore branchées (distance, affluence, raison et score de recommandation) :
 * repris des données de démo quand le salon y figure, sinon valeurs neutres.
 */

/** Quartiers rattachés à « Tunis » dans la recherche par ville */
const TUNIS_AREA = ["Tunis", "La Marsa", "Carthage", "El Menzah", "Les Berges du Lac", "Ennasr"];

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (text: string) => new RegExp(escapeRegex(text), "i");

async function nextSlotsToday(salonId: string, now: Date) {
  const { slots } = await getAvailability({ salonId, date: tunisToday(now), durationMin: 30 });
  return slots.filter((s) => s.employees.length > 0).slice(0, 4).map((s) => s.time);
}

const activeServices = (salon: SalonDoc) =>
  salon.services.filter((s) => s.active).sort((a, b) => Number(b.popular) - Number(a.popular) || a.position - b.position);

const sortedPhotos = (salon: SalonDoc) => [...salon.photos].sort((a, b) => a.position - b.position);

async function toView(row: SalonDoc, opts: { visitedSalonIds: Set<string>; favoriteIds?: Set<string>; now: Date; withSlots: boolean }): Promise<SalonView> {
  const id = idOf(row);
  const mock = getMockSalon(row.slug);
  const services = activeServices(row);
  const photos = sortedPhotos(row);
  const prices = services.map((s) => s.price);
  return {
    slug: row.slug,
    name: row.name,
    category: row.category as CategoryId,
    specialties: row.specialties,
    city: row.city,
    address: row.address,
    rating: row.ratingAvg,
    reviewCount: row.reviewCount,
    priceFrom: prices.length ? Math.min(...prices) : 0,
    verified: row.verified,
    cover: row.coverUrl ?? photos[0]?.url ?? "",
    gallery: photos.map((p) => p.url ?? ""),
    lat: row.lat,
    lng: row.lng,
    visited: opts.visitedSalonIds.has(id),
    favorite: opts.favoriteIds?.has(id) ?? false,
    nextSlots: opts.withSlots ? await nextSlotsToday(id, opts.now) : [],
    topServices: services.slice(0, 3).map((s) => ({ name: s.name, price: s.price, duration: s.durationMin })),
    // Champs IA (recommandation, affluence) — démo en attendant les modules P1 et P2
    distanceKm: mock?.distanceKm ?? 0,
    affluence: mock?.affluence ?? "calme",
    waitMinutes: mock?.waitMinutes ?? 0,
    offPeak: mock?.offPeak,
    aiReason: mock?.aiReason ?? "",
    matchScore: mock?.matchScore ?? 50,
  };
}

async function favoriteSalonIds(userId?: string) {
  const _id = objectId(userId);
  if (!_id) return new Set<string>();
  const user = await User.findById(_id, { favorites: 1 }).lean();
  return new Set((user?.favorites ?? []).map((f) => f.toString()));
}

async function visitedSalonIds(userId?: string) {
  const client = objectId(userId);
  if (!client) return new Set<string>();
  const ids = await Booking.distinct("salon", { client, status: "COMPLETED" });
  return new Set(ids.map((id) => id.toString()));
}

export type SalonSearch = { q?: string; city?: string; category?: CategoryId; sort?: "recommande" | "note" | "prix" | "distance" };

/** RES-01 : recherche par ville, service ou nom, catégorie ; seuls les salons validés et actifs apparaissent */
export async function searchSalons(params: SalonSearch, userId?: string, now = new Date()) {
  const and: Record<string, unknown>[] = [{ status: "ACTIVE" }];
  if (params.city) {
    const city = params.city.trim();
    and.push(city.toLowerCase() === "tunis" ? { city: { $in: TUNIS_AREA } } : { $or: [{ city: contains(city) }, { address: contains(city) }] });
  }
  if (params.category) and.push({ category: params.category as Category });
  if (params.q) {
    const q = params.q.trim();
    and.push({ $or: [{ name: contains(q) }, { specialties: q }, { services: { $elemMatch: { name: contains(q), active: true } } }] });
  }

  const [rows, visited, favorites] = await Promise.all([Salon.find({ $and: and }).lean<SalonDoc[]>(), visitedSalonIds(userId), favoriteSalonIds(userId)]);
  const salons = await Promise.all(rows.map((row) => toView(row, { visitedSalonIds: visited, favoriteIds: favorites, now, withSlots: true })));

  const sorters: Record<NonNullable<SalonSearch["sort"]>, (a: SalonView, b: SalonView) => number> = {
    recommande: (a, b) => b.matchScore - a.matchScore,
    note: (a, b) => b.rating - a.rating,
    prix: (a, b) => a.priceFrom - b.priceFrom,
    distance: (a, b) => a.distanceKm - b.distanceKm,
  };
  return salons.sort(sorters[params.sort ?? "recommande"]);
}

/** Salons recommandés (accueil, espace client) — en attendant l'IA de recommandation (P1) : tri par score de démo */
export async function recommendedSalons(limit: number, userId?: string, opts: { excludeVisited?: boolean } = {}) {
  const salons = await searchSalons({ sort: "recommande" }, userId);
  return salons.filter((s) => !opts.excludeVisited || !s.visited).slice(0, limit);
}

/** CLI-03 : salons favoris */
export async function favoriteSalons(userId: string) {
  const favorites = await favoriteSalonIds(userId);
  if (!favorites.size) return [];
  const all = await searchSalons({}, userId);
  return all.filter((s) => s.favorite);
}

/** RES-02 : fiche complète — services groupés, équipe, horaires, avis vérifiés publiés (mis en cache le temps d'une requête) */
export const getSalonDetail = cache(async (salonSlug: string, userId?: string) => {
  const now = new Date();
  const row = await Salon.findOne({ slug: salonSlug }).lean<SalonDoc>();
  if (!row || row.status !== "ACTIVE") return null;
  const id = idOf(row);

  const [visited, favorites, employees, reviews, ratings, sentiments] = await Promise.all([
    visitedSalonIds(userId),
    favoriteSalonIds(userId),
    Employee.find({ salon: row._id, active: true }).sort({ createdAt: 1 }).lean(),
    Review.find({ salon: row._id, status: "PUBLISHED" }).sort({ createdAt: -1 }).limit(10).lean(),
    Review.aggregate<{ _id: number; count: number }>([{ $match: { salon: row._id, status: "PUBLISHED" } }, { $group: { _id: "$rating", count: { $sum: 1 } } }]),
    Review.aggregate<{ _id: string; count: number }>([{ $match: { salon: row._id, status: "PUBLISHED", sentiment: { $ne: null } } }, { $group: { _id: "$sentiment", count: { $sum: 1 } } }]),
  ]);

  const [clients, reviewEmployees, bookings] = await Promise.all([
    User.find({ _id: { $in: reviews.map((r) => r.client) } }, { firstName: 1, lastName: 1, avatarUrl: 1 }).lean(),
    Employee.find({ _id: { $in: reviews.map((r) => r.employee).filter(Boolean) } }, { name: 1 }).lean(),
    Booking.find({ _id: { $in: reviews.map((r) => r.booking) } }, { items: 1 }).lean(),
  ]);
  const clientById = new Map(clients.map((c) => [idOf(c), c]));
  const employeeById = new Map(reviewEmployees.map((e) => [idOf(e), e]));
  const bookingById = new Map(bookings.map((b) => [idOf(b), b]));

  const salon = await toView(row, { visitedSalonIds: visited, now, withSlots: true });
  const analysed = sentiments.reduce((a, x) => a + x.count, 0);
  const share = (key: string) => (analysed ? Math.round(((sentiments.find((x) => x._id === key)?.count ?? 0) / analysed) * 100) : 0);
  const today = utcToTunis(now);
  const todayHours = row.openingHours.find((o) => o.weekday === today.weekday) ?? null;

  const groups: { id: string; label: string; services: { id: string; name: string; description?: string; duration: number; price: number; oldPrice?: number; popular?: boolean }[] }[] = [];
  for (const s of activeServices(row).sort((a, b) => a.position - b.position)) {
    let group = groups.find((g) => g.label === s.group);
    if (!group) groups.push((group = { id: slugify(s.group), label: s.group, services: [] }));
    group.services.push({ id: s.key, name: s.name, description: s.description ?? undefined, duration: s.durationMin, price: s.price, oldPrice: s.oldPrice ?? undefined, popular: s.popular });
  }

  return {
    salon,
    id,
    description: row.description ?? null,
    amenities: row.amenities,
    depositAmount: row.depositAmount,
    cancellationHours: row.cancellationHours,
    salonPointsPerVisit: row.salonPointsPerVisit ?? 0,
    favorite: favorites.has(id),
    serviceGroups: groups,
    employees: employees.map((e) => ({ id: e.key, name: e.name, role: e.title, rating: e.rating, avatar: e.avatarUrl ?? undefined, color: e.color as 1 | 2 | 3 | 4 | 5 })),
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
      const h = row.openingHours.find((o) => o.weekday === weekday);
      return { weekday, hours: h ? `${h.opensAt} – ${h.closesAt}` : null };
    }),
    reviews: reviews.map((r) => {
      const client = clientById.get(r.client.toString());
      return {
        id: idOf(r),
        author: `${client?.firstName ?? ""} ${(client?.lastName ?? "").charAt(0)}.`,
        avatar: client?.avatarUrl ?? undefined,
        date: utcToTunis(r.createdAt).date,
        rating: r.rating,
        service: (bookingById.get(r.booking.toString())?.items ?? []).map((i) => i.name).join(" + "),
        employee: (r.employee && employeeById.get(r.employee.toString())?.name) || "",
        text: r.text,
        lang: r.lang,
        photo: r.photoUrl ?? undefined,
        reply: r.reply ?? undefined,
        helpful: r.helpful,
      };
    }),
    distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: ratings.find((d) => d._id === stars)?.count ?? 0 })),
    /** Répartition des sentiments (analyse IA des avis, P4) en % */
    sentiment: { positif: share("positif"), neutre: share("neutre"), negatif: share("negatif"), analysed },
    today: {
      weekday: today.weekday,
      open: Boolean(todayHours && today.time >= (todayHours.opensAt ?? "") && today.time < (todayHours.closesAt ?? "")),
      closesAt: todayHours?.closesAt ?? null,
    },
  };
});

export type SalonDetail = NonNullable<Awaited<ReturnType<typeof getSalonDetail>>>;
