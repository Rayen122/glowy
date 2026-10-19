import { shortName } from "@/core/domain/text";
import { utcToTunis } from "@/core/domain/time";
import { Booking, Employee, idOf, objectId, Review, ReviewReport, User } from "@/infrastructure/db";

export const STAFF_REVIEW_FILTERS = ["all", "unanswered", "reported", "hidden"] as const;
export type StaffReviewFilter = (typeof STAFF_REVIEW_FILTERS)[number];

/** AVI-04 / AVI-05 : avis du salon vus par le personnel (réponse, signalement, analyse) */
export async function salonReviewsForStaff(salonId: string, filter: StaffReviewFilter = "all") {
  const salon = objectId(salonId)!;
  const openReports = await ReviewReport.find({ status: "OPEN" }, { review: 1 }).lean();
  const reportedIds = openReports.map((r) => r.review);
  const query = {
    salon,
    ...(filter === "unanswered" ? { reply: null, status: "PUBLISHED" as const } : {}),
    ...(filter === "reported" ? { _id: { $in: reportedIds } } : {}),
    ...(filter === "hidden" ? { status: "HIDDEN" as const } : {}),
  };
  const [reviews, counts] = await Promise.all([
    Review.find(query).sort({ createdAt: -1 }).limit(60).lean(),
    Promise.all([
      Review.countDocuments({ salon }),
      Review.countDocuments({ salon, reply: null, status: "PUBLISHED" as const }),
      Review.countDocuments({ salon, _id: { $in: reportedIds } }),
      Review.countDocuments({ salon, status: "HIDDEN" as const }),
    ]),
  ]);
  const [clients, employees, bookings] = await Promise.all([
    User.find({ _id: { $in: reviews.map((r) => r.client) } }, { firstName: 1, lastName: 1 }).lean(),
    Employee.find({ _id: { $in: reviews.map((r) => r.employee).filter(Boolean) } }, { name: 1 }).lean(),
    Booking.find({ _id: { $in: reviews.map((r) => r.booking) } }, { items: 1 }).lean(),
  ]);
  const reported = new Set(reportedIds.map(String));
  return {
    counts: { all: counts[0], unanswered: counts[1], reported: counts[2], hidden: counts[3] },
    rows: reviews.map((r) => {
      const client = clients.find((c) => c._id.equals(r.client));
      return {
        id: idOf(r),
        author: client ? shortName(client.firstName, client.lastName) : "—",
        rating: r.rating,
        text: r.text,
        lang: r.lang,
        photoUrl: r.photoUrl ?? null,
        date: utcToTunis(r.createdAt).date,
        reply: r.reply ?? null,
        status: r.status,
        sentiment: (r.sentiment ?? null) as "positif" | "neutre" | "negatif" | null,
        suspicion: r.suspicion ?? null,
        reported: reported.has(idOf(r)),
        employee: employees.find((e) => r.employee && e._id.equals(r.employee))?.name ?? null,
        service: bookings.find((b) => b._id.equals(r.booking))?.items.map((i) => i.name).join(" + ") ?? "",
      };
    }),
  };
}

export type StaffReviewRow = Awaited<ReturnType<typeof salonReviewsForStaff>>["rows"][number];
