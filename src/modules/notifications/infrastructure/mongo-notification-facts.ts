import { shortName } from "@/core/domain/text";
import { Booking, objectId, Review, Salon, User, type UserDoc } from "@/infrastructure/db";
import type { NotificationFacts } from "../application/ports";

export const mongoNotificationFacts: NotificationFacts = {
  async salon(salonId) {
    const salon = await Salon.findById(objectId(salonId)).populate<{ owner: UserDoc }>("owner", "email").orFail().lean();
    return { name: salon.name, city: salon.city, ownerId: salon.owner._id.toString(), ownerEmail: salon.owner.email };
  },
  activeAdminIds: async () => (await User.find({ role: "ADMIN", status: "ACTIVE" }, { _id: 1 }).lean()).map((u) => u._id.toString()),
  async booking(bookingId) {
    const b = await Booking.findById(objectId(bookingId))
      .populate<{ client: UserDoc }>("client", "firstName lastName email phone")
      .populate<{ salon: { name: string; owner: unknown } }>("salon", "name owner")
      .orFail()
      .lean();
    return {
      clientId: b.client._id.toString(),
      clientName: shortName(b.client.firstName, b.client.lastName),
      clientEmail: b.client.email,
      clientPhone: b.client.phone ?? null,
      salonName: b.salon.name,
      salonOwnerId: String(b.salon.owner),
      startsAt: b.startsAt,
    };
  },
  async review(reviewId) {
    const r = await Review.findById(objectId(reviewId)).populate<{ salon: { owner: unknown } }>("salon", "owner").orFail().lean();
    return { rating: r.rating, text: r.text, salonOwnerId: String(r.salon.owner) };
  },
};
