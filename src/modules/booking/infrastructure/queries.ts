import { shortName } from "@/core/domain/text";
import { tunisDayRange, utcToTunis } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Review, Salon, TimeOff, User } from "@/infrastructure/db";
import { toBookingRecord } from "./mongo-booking-repository";

/** Lectures pour l'interface (pas de règle métier) */

/** Historique de la cliente (CLI-02), du plus récent au plus ancien */
export async function listClientBookings(clientId: string) {
  const client = objectId(clientId);
  if (!client) return [];
  const bookings = await Booking.find({ client }).sort({ startsAt: -1 }).lean();
  const [salons, employees, reviews] = await Promise.all([
    Salon.find({ _id: { $in: [...new Set(bookings.map((b) => b.salon.toString()))] } }, { slug: 1, name: 1, city: 1, address: 1, coverUrl: 1, lat: 1, lng: 1, cancellationHours: 1 }).lean(),
    Employee.find({ _id: { $in: [...new Set(bookings.map((b) => b.employee.toString()))] } }, { name: 1 }).lean(),
    Review.find({ booking: { $in: bookings.map((b) => b._id) } }, { booking: 1 }).lean(),
  ]);
  const salonById = new Map(salons.map((s) => [idOf(s), s]));
  const employeeById = new Map(employees.map((e) => [idOf(e), e]));
  const reviewByBooking = new Map(reviews.map((r) => [r.booking.toString(), idOf(r)]));

  return bookings.map((b) => {
    const salon = salonById.get(b.salon.toString())!;
    const reviewId = reviewByBooking.get(idOf(b));
    return {
      ...toBookingRecord(b),
      salon: {
        slug: salon.slug,
        name: salon.name,
        city: salon.city,
        address: salon.address,
        coverUrl: salon.coverUrl ?? null,
        lat: salon.lat,
        lng: salon.lng,
        cancellationHours: salon.cancellationHours,
      },
      employee: { name: employeeById.get(b.employee.toString())?.name ?? "" },
      items: b.items.map((i) => ({ name: i.name ?? "", price: i.price ?? 0 })),
      review: reviewId ? { id: reviewId } : null,
      local: utcToTunis(b.startsAt),
    };
  });
}

export type ClientBooking = Awaited<ReturnType<typeof listClientBookings>>[number];

/** Agenda d'un salon pour une journée (SAL-04) : employés, rendez-vous, blocages */
export async function salonAgenda(salonId: string, date: string) {
  const salon = objectId(salonId);
  const { start, end } = tunisDayRange(date);
  const employees = await Employee.find({ salon, active: true }).sort({ createdAt: 1 }).lean();
  const [bookings, timeOff] = await Promise.all([
    Booking.find({ salon, startsAt: { $lt: end }, endsAt: { $gt: start }, status: { $ne: "CANCELLED" } }).sort({ startsAt: 1 }).lean(),
    TimeOff.find({ employee: { $in: employees.map((e) => e._id) }, startsAt: { $lt: end }, endsAt: { $gt: start } }).lean(),
  ]);
  const clients = await User.find({ _id: { $in: bookings.map((b) => b.client) } }, { firstName: 1, lastName: 1 }).lean();
  const clientById = new Map(clients.map((c) => [idOf(c), c]));

  return {
    date,
    employees: employees.map((e) => ({ id: idOf(e), key: e.key, name: e.name, title: e.title, color: e.color, avatarUrl: e.avatarUrl ?? null, rating: e.rating })),
    bookings: bookings.map((b) => {
      const client = clientById.get(b.client.toString());
      return {
        id: idOf(b),
        employeeId: b.employee.toString(),
        status: b.status,
        time: utcToTunis(b.startsAt).time,
        end: utcToTunis(b.endsAt).time,
        client: client ? shortName(client.firstName, client.lastName) : "",
        service: b.items.map((i) => i.name).join(" + "),
        price: b.totalPrice,
      };
    }),
    blocks: timeOff.map((t) => ({ employeeId: t.employee.toString(), time: utcToTunis(t.startsAt).time, end: utcToTunis(t.endsAt).time, label: t.label })),
  };
}
