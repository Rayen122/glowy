import { disconnectDb, Employee, resetAll, Salon, User } from "@/infrastructure/db";
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

/** Lundi lointain : jamais « dans le passé » quel que soit le jour où les tests tournent */
export const FUTURE_MONDAY = "2030-01-07";

/** Module réservation avec une horloge après les rendez-vous de test : le salon peut les commencer, terminer, marquer absents */
export const afterVisit = createBookingModule({ clock: { now: () => new Date("2030-02-01T12:00:00Z") } });
