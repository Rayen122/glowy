import { disconnectDb, Employee, resetAll, Salon, User } from "@/infrastructure/db";
import { addDays, tunisToday, weekdayOf } from "@/core/domain/time";
import { createBookingModule } from "@/modules/booking";

/** Vide toutes les collections de la base de test et recrée les index (dont l'index unique des tranches) */
export const resetDb = resetAll;

export const closeDb = () => disconnectDb();

let n = 0;
export async function makeUser(role: "CLIENT" | "MANAGER" | "EMPLOYEE" | "ADMIN" = "CLIENT", extra: { referredBy?: string } = {}) {
  n += 1;
  const user = await User.create({ email: `user${n}@test.tn`, firstName: `Test${n}`, lastName: "User", role, referralCode: `TEST-${n}`, ...extra });
  return { id: user._id.toString(), role };
}

/** Salon actif ouvert tous les jours 08:00–20:00, deux employées, deux prestations */
export async function makeSalon(slug = "salon-test") {
  const owner = await makeUser("MANAGER");
  const salon = await Salon.create({
    slug,
    name: `Salon ${slug}`,
    category: "coiffure",
    specialties: ["Coiffure"],
    city: "Tunis",
    address: "1 rue du Test",
    lat: 36.8,
    lng: 10.18,
    status: "ACTIVE",
    verified: true,
    owner: owner.id,
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "08:00", closesAt: "20:00" })),
    services: [
      { key: "coupe", name: "Coupe", group: "Coupe", durationMin: 30, price: 20 },
      { key: "balayage", name: "Balayage", group: "Couleur", durationMin: 120, price: 150 },
    ],
  });
  await Employee.create([
    { salon: salon._id, key: "amira", name: "Amira", title: "Coiffeuse" },
    { salon: salon._id, key: "nour", name: "Nour", title: "Coiffeuse" },
  ]);
  return { salon: { id: salon._id.toString() }, owner };
}

/**
 * Lundi à venir (dans 2 à 3 semaines) : jamais « dans le passé », et dans l'horizon de réservation de 90 jours,
 * quel que soit le jour où les tests tournent.
 */
export const FUTURE_MONDAY = (() => {
  const today = tunisToday();
  for (let i = 14; ; i++) if (weekdayOf(addDays(today, i)) === 1) return addDays(today, i);
})();

/** Module réservation avec une horloge après les rendez-vous de test : le salon peut les commencer, terminer, marquer absents */
export const afterVisit = createBookingModule({ clock: { now: () => new Date(`${addDays(FUTURE_MONDAY, 25)}T12:00:00Z`) } });
