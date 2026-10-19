import type { Metadata } from "next";
import Link from "next/link";
import { ManageHeader } from "@/components/manage/kit";
import { ReviewsManager } from "@/components/manage/reviews-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { staffSalon } from "@/modules/dashboard";
import { salonReviewsForStaff, STAFF_REVIEW_FILTERS, type StaffReviewFilter } from "@/modules/reviews";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.reviews.title };
}

/** AVI-04 (réponse publique) et AVI-05 (signalement) côté salon */
export default async function SalonReviewsPage({ searchParams }: PageProps<"/dashboard/avis">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const sp = await searchParams;
  const asked = Array.isArray(sp.filtre) ? sp.filtre[0] : sp.filtre;
  const filter: StaffReviewFilter = (STAFF_REVIEW_FILTERS as readonly string[]).includes(asked ?? "") ? (asked as StaffReviewFilter) : "all";
  const salon = await staffSalon(user);
  const [{ t, nf }, data] = await Promise.all([getI18n(), salonReviewsForStaff(salon.id, filter)]);
  const m = t.manage.reviews;
  return (
    <div className="space-y-5">
      <ManageHeader title={m.title} description={m.description} />
      <nav className="flex flex-wrap gap-2" aria-label={m.title}>
        {STAFF_REVIEW_FILTERS.map((key) => (
          <Link
            key={key}
            href={key === "all" ? "?" : `?filtre=${key}`}
            aria-current={key === filter ? "page" : undefined}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1", key === filter ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
          >
            {m.filters[key]} <span className="tabular-nums opacity-70">{nf(data.counts[key])}</span>
          </Link>
        ))}
      </nav>
      <ReviewsManager reviews={data.rows} canReply={user.role !== "EMPLOYEE"} />
    </div>
  );
}
