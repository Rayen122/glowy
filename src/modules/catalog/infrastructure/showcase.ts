import { addDays, tunisToday } from "@/core/domain/time";
import { idOf, Review, Salon } from "@/infrastructure/db";
import { getAvailability } from "@/modules/booking";
import { roundRating } from "@/modules/reviews";

/**
 * Chiffres de la vitrine (accueil, espace pro, pages de connexion), lus en base : salons vérifiés en ligne,
 * avis publiés, note moyenne, et un vrai salon avec ses prochains créneaux libres. Jamais de valeurs en dur
 * (« 1 342 salons » quand la plateforme en compte 12 : promesse fausse). Cache de 5 minutes.
 */
export type Showcase = {
  salons: number;
  reviews: number;
  /** null tant qu'aucun avis n'est publié */
  rating: number | null;
  featured: { name: string; city: string; slug: string; rating: number; date: string; today: boolean; slots: string[] } | null;
};

const TTL_MS = 5 * 60_000;
let cached: { at: number; value: Showcase } | null = null;

export async function platformShowcase(now = new Date()): Promise<Showcase> {
  if (cached && now.getTime() - cached.at < TTL_MS) return cached.value;
  const [salons, [reviews], top] = await Promise.all([
    Salon.countDocuments({ status: "ACTIVE", verified: true }),
    Review.aggregate<{ count: number; average: number }>([{ $match: { status: "PUBLISHED" } }, { $group: { _id: null, count: { $sum: 1 }, average: { $avg: "$rating" } } }]),
    Salon.findOne({ status: "ACTIVE", verified: true, reviewCount: { $gt: 0 } }, { name: 1, city: 1, slug: 1, ratingAvg: 1 })
      .sort({ ratingAvg: -1, reviewCount: -1 })
      .lean(),
  ]);

  // Salon le mieux noté et ses 3 prochains créneaux libres (aujourd'hui, sinon le premier jour qui en a)
  let featured: Showcase["featured"] = null;
  if (top) {
    const today = tunisToday(now);
    for (let i = 0; i < 7 && !featured; i++) {
      const date = addDays(today, i);
      const { slots } = await getAvailability({ salonId: idOf(top), date, durationMin: 30 });
      const free = slots.filter((s) => s.employees.length > 0).slice(0, 3).map((s) => s.time);
      if (free.length) featured = { name: top.name, city: top.city, slug: top.slug, rating: roundRating(top.ratingAvg), date, today: i === 0, slots: free };
    }
  }

  const value = { salons, reviews: reviews?.count ?? 0, rating: reviews ? roundRating(reviews.average) : null, featured };
  cached = { at: now.getTime(), value };
  return value;
}
