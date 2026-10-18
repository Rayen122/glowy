import { Booking, objectId, Review, Salon, User } from "@/infrastructure/db";
import type { LoyaltyFacts } from "../application/ports";

const salonName = async (salonId: unknown) => (await Salon.findById(salonId, { name: 1 }).orFail().lean()).name;

export const mongoLoyaltyFacts: LoyaltyFacts = {
  async completedBooking(bookingId) {
    const booking = await Booking.findById(objectId(bookingId)).lean();
    if (!booking || booking.status !== "COMPLETED") return null;
    const client = await User.findById(booking.client, { firstName: 1, referredBy: 1 }).orFail().lean();
    const [name, earlierCompletedHere, visited, completedCount, referrer] = await Promise.all([
      salonName(booking.salon),
      Booking.countDocuments({ client: booking.client, salon: booking.salon, status: "COMPLETED", _id: { $ne: booking._id } }),
      Booking.distinct("salon", { client: booking.client, status: "COMPLETED" }),
      Booking.countDocuments({ client: booking.client, status: "COMPLETED" }),
      client.referredBy ? User.findById(client.referredBy, { firstName: 1 }).lean() : null,
    ]);
    return {
      bookingId: booking._id.toString(),
      clientId: booking.client.toString(),
      clientFirstName: client.firstName,
      salonId: booking.salon.toString(),
      salonName: name,
      offPeak: booking.offPeak,
      paymentMethod: booking.paymentMethod,
      bookedHoursAhead: (booking.startsAt.getTime() - booking.createdAt.getTime()) / 3_600_000,
      earlierCompletedHere,
      visitedSalons: visited.length,
      completedCount,
      referrer: referrer ? { id: referrer._id.toString(), firstName: referrer.firstName } : null,
    };
  },
  async booking(bookingId) {
    const booking = await Booking.findById(objectId(bookingId), { client: 1, salon: 1 }).orFail().lean();
    return { clientId: booking.client.toString(), salonId: booking.salon.toString(), salonName: await salonName(booking.salon) };
  },
  async review(reviewId) {
    const review = await Review.findById(objectId(reviewId), { client: 1, salon: 1, photoUrl: 1 }).orFail().lean();
    return { clientId: review.client.toString(), salonId: review.salon.toString(), salonName: await salonName(review.salon), hasPhoto: Boolean(review.photoUrl) };
  },
};
