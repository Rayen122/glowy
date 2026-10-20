import type { Metadata } from "next";
import Link from "next/link";
import { ManageHeader } from "@/components/manage/kit";
import { ReviewsManager } from "@/components/manage/reviews-manager";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { staffSalon } from "@/modules/dashboard";
import { Flag, Sparkles, ThumbsUp } from "lucide-react";
import { salonReviewInsights, salonReviewsForStaff, STAFF_REVIEW_FILTERS, type StaffReviewFilter } from "@/modules/reviews";

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
  const [{ t, f, nf }, data, insights] = await Promise.all([getI18n(), salonReviewsForStaff(salon.id, filter), salonReviewInsights(salon.id)]);
  const m = t.manage.reviews;
  const ins = t.insights;
  return (
    <div className="space-y-5">
      <ManageHeader title={m.title} description={m.description} />
      {/* IA P4 : ce que disent les avis analysés */}
      <section aria-labelledby="insights-title" className="rounded-3xl bg-blush/50 p-5 ring-1 ring-plum-200/60">
        <h2 id="insights-title" className="flex items-center gap-2 text-sm font-semibold text-plum-800">
          <Sparkles className="size-4" aria-hidden /> {t.salon.aiSummary}
        </h2>
        {insights.analysed < 3 ? (
          <p className="mt-2 text-sm text-muted-foreground">{ins.notEnough}</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <p className="text-sm">
              <span className="text-2xl font-semibold text-success tabular-nums">{nf(insights.sentiment.positif)} %</span>
              <span className="block text-xs text-muted-foreground">{f(ins.basedOn, { n: insights.analysed })}</span>
            </p>
            <ul className="space-y-1 text-sm">
              {insights.strengths.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <ThumbsUp className="size-3.5 text-success" aria-hidden /> {ins.aspectTitles[a]}
                </li>
              ))}
            </ul>
            <ul className="space-y-1 text-sm">
              {insights.weaknesses.length === 0 && <li className="text-muted-foreground">{ins.noWeakness}</li>}
              {insights.weaknesses.map((a) => (
                <li key={a} className="flex items-center gap-2">
                  <Flag className="size-3.5 text-warning" aria-hidden /> {ins.aspectTitles[a]}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
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
