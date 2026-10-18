import { AuditLog, Booking, idOf, objectId, Review, ReviewReport, Salon, withTransaction, type ReviewDoc } from "@/infrastructure/db";
import { MODERATION, roundRating } from "../domain/policy";
import type { ReviewRecord, ReviewRepository } from "../application/ports";

const toRecord = (r: ReviewDoc): ReviewRecord => ({
  id: idOf(r),
  bookingId: r.booking.toString(),
  clientId: r.client.toString(),
  salonId: r.salon.toString(),
  rating: r.rating,
  text: r.text,
  status: r.status,
  reply: r.reply ?? null,
});

export const mongoReviewRepository: ReviewRepository = {
  async bookingForReview(bookingId) {
    const _id = objectId(bookingId);
    const booking = _id ? await Booking.findById(_id, { client: 1, salon: 1, employee: 1, status: 1 }).lean() : null;
    if (!booking) return null;
    return {
      clientId: booking.client.toString(),
      salonId: booking.salon.toString(),
      employeeId: booking.employee.toString(),
      status: booking.status,
      reviewed: (await Review.exists({ booking: booking._id })) !== null,
    };
  },

  async create(data) {
    const review = await Review.create({
      booking: objectId(data.bookingId)!,
      client: objectId(data.clientId)!,
      salon: objectId(data.salonId)!,
      employee: objectId(data.employeeId),
      rating: data.rating,
      text: data.text,
      photoUrl: data.photoUrl ?? null,
      lang: data.lang,
    });
    return toRecord(review.toObject());
  },

  async findById(id) {
    const _id = objectId(id);
    const review = _id ? await Review.findById(_id).lean() : null;
    return review ? toRecord(review) : null;
  },

  reply: async (id, text, at) => toRecord(await Review.findByIdAndUpdate(objectId(id), { $set: { reply: text, repliedAt: at } }, { returnDocument: "after" }).orFail().lean()),

  report: async ({ reviewId, reporterId, source, reason }) => {
    const report = await ReviewReport.create({ review: objectId(reviewId)!, reporter: objectId(reporterId), source, reason });
    return { id: idOf(report) };
  },

  moderate: (id, decision, actorId, at) =>
    withTransaction(async (session) => {
      const review = objectId(id)!;
      const outcome = MODERATION[decision];
      await ReviewReport.updateMany({ review, status: "OPEN" }, { $set: { status: outcome.reports, resolvedBy: objectId(actorId), resolvedAt: at } }, { session });
      await AuditLog.create([{ actor: objectId(actorId), action: `review.${decision}`, targetType: "Review", targetId: id }], { session });
      return toRecord(await Review.findByIdAndUpdate(review, { $set: { status: outcome.review } }, { session, returnDocument: "after" }).orFail().lean());
    }),

  async refreshSalonRating(salonId) {
    const salon = objectId(salonId);
    const [agg] = await Review.aggregate<{ avg: number; count: number }>([
      { $match: { salon, status: "PUBLISHED" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await Salon.updateOne({ _id: salon }, { $set: { ratingAvg: roundRating(agg?.avg), reviewCount: agg?.count ?? 0 } });
  },
};
