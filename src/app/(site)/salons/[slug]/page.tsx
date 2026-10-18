import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Flag,
  Images,
  Languages,
  MapPin,
  MessageSquareText,
  Navigation,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
} from "lucide-react";
import { ForecastBars } from "@/components/charts/forecast-bars";
import { AffluencePill, PointsBadge, Rating, VerifiedBadge } from "@/components/salon/badges";
import { FavoriteButton } from "@/components/salon/favorite-button";
import { ShareButton } from "@/components/salon/share-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/auth";
import { getI18n } from "@/i18n/server";
import { getSalonDetail } from "@/modules/catalog";
import {
  REVIEW_SUMMARY,
  TODAY_FORECAST,
  weekdayIso,
} from "@/lib/data";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/salons/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const session = await auth();
  const detail = await getSalonDetail(slug, session?.user.id);
  if (!detail) return {};
  const salon = detail.salon;
  const { t, tc, f, nf } = await getI18n();
  return {
    title: f(t.salon.metaTitle, { name: salon.name, city: tc(salon.city) }),
    description: f(t.salon.metaDescription, {
      specialties: salon.specialties.map(tc).join(", "),
      city: tc(salon.city),
      rating: nf(salon.rating),
      count: nf(salon.reviewCount),
    }),
  };
}

const SECTIONS = ["prestations", "equipe", "avis", "infos"] as const;

export default async function SalonPage({ params }: PageProps<"/salons/[slug]">) {
  const { slug } = await params;
  const session = await auth();
  const detail = await getSalonDetail(slug, session?.user.id);
  if (!detail) notFound();
  const salon = detail.salon;

  const { t, tc, f, nf, money, dur, df, hour, locale } = await getI18n();
  const s = t.salon;
  const totalReviews = Math.max(1, detail.distribution.reduce((a, d) => a + d.count, 0));
  const { positif, neutre, negatif } = detail.sentiment;
  // Résumé textuel produit par l'IA d'analyse des avis (P4) : démo disponible pour le Salon Yasmine
  const aiSummary = salon.slug === "salon-yasmine-la-marsa" ? REVIEW_SUMMARY : null;

  return (
    <div className="container-page pt-4 pb-12 lg:pb-20">
      {/* Fil d'Ariane */}
      <nav aria-label={s.breadcrumb} className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center hover:text-foreground">
          {s.home}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
        <Link href={`/salons?ville=${encodeURIComponent(salon.city)}`} className="inline-flex min-h-11 shrink-0 items-center hover:text-foreground">
          {tc(salon.city)}
        </Link>
        <ChevronRight className="size-3.5 shrink-0 rtl:rotate-180" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">
          {salon.name}
        </span>
      </nav>

      {/* En-tête */}
      <header data-animate="fade-up" className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display text-[2.25rem] text-ink sm:text-5xl">{salon.name}</h1>
            {salon.verified && <VerifiedBadge className="h-7 px-3 text-sm" />}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Rating value={salon.rating} count={salon.reviewCount} size="md" />
            <span>{salon.specialties.map(tc).join(" · ")}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4 shrink-0" aria-hidden /> {salon.address}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4 shrink-0" aria-hidden />
              {detail.today.open ? (
                <>
                  <span className="font-medium text-success">{s.open}</span> · {f(s.closesAt, { time: detail.today.closesAt ?? "" })}
                </>
              ) : (
                <span className="font-medium text-muted-foreground">{s.closed}</span>
              )}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareButton title={salon.name} />
          <FavoriteButton salonName={salon.name} salonSlug={salon.slug} variant="outline" initial={detail.favorite} />
        </div>
      </header>

      {/* Galerie */}
      <section aria-label={s.photos} className="mt-6">
        <div data-animate="stagger" data-stagger="0.07" className="relative grid h-[240px] grid-cols-4 grid-rows-2 gap-1.5 overflow-hidden rounded-2xl sm:h-[340px] sm:gap-2 sm:rounded-3xl md:h-[440px]">
          {salon.gallery.map((src, i) => (
            <div key={src + i} className={cn("relative bg-muted", i === 0 && "col-span-2 row-span-2")}>
              <Image
                src={src}
                alt={i === 0 ? f(t.common.salonInterior, { name: salon.name }) : f(s.photoAlt, { n: i + 1, name: salon.name })}
                fill
                priority={i === 0}
                sizes={i === 0 ? "50vw" : "25vw"}
                className="object-cover transition-opacity hover:opacity-95"
              />
            </div>
          ))}
          <button
            type="button"
            className="absolute end-2.5 bottom-2.5 inline-flex h-11 items-center gap-1.5 rounded-full bg-card px-3 sm:h-9 text-xs font-medium shadow-soft ring-1 ring-border hover:bg-muted sm:end-4 sm:bottom-4 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
          >
            <Images className="size-4" aria-hidden />
            {f(s.seeAllPhotos, { n: 24 })}
          </button>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {/* Sous-navigation */}
          <nav
            aria-label={s.sectionsNav}
            className="no-scrollbar sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background/90 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:top-[calc(72px+env(safe-area-inset-top))] lg:mx-0 lg:px-0"
          >
            {SECTIONS.map((id) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 border-b-2 border-transparent px-3 py-3.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:border-plum-300 hover:text-foreground"
              >
                {s.sections[id]}
              </a>
            ))}
          </nav>

          {/* Prestations */}
          <section id="prestations" className="scroll-mt-36 pt-10" aria-labelledby="prestations-title">
            <h2 id="prestations-title" className="display text-3xl text-ink">
              {s.sections.prestations}
            </h2>
            <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {detail.serviceGroups.map((g, i) => (
                <a
                  key={g.id}
                  href={`#grp-${g.id}`}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors",
                    i === 0 ? "bg-ink text-white" : "border border-border bg-card hover:bg-muted"
                  )}
                >
                  {tc(g.label)}
                </a>
              ))}
            </div>

            <div data-animate="stagger" data-stagger="0.1" className="mt-6 space-y-8">
              {detail.serviceGroups.map((g) => (
                <div key={g.id} id={`grp-${g.id}`} className="scroll-mt-40">
                  <h3 className="text-lg font-semibold text-foreground">{tc(g.label)}</h3>
                  <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                    {g.services.map((sv) => (
                      <li key={sv.id} className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                            {tc(sv.name)}
                            {sv.popular && (
                              <span className="rounded-full bg-blush px-2 py-0.5 text-[11px] font-semibold text-plum-700">{s.popular}</span>
                            )}
                          </p>
                          {sv.description && <p className="mt-1 text-sm text-muted-foreground">{tc(sv.description)}</p>}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden /> {dur(sv.duration)}
                            </span>
                            <span className="font-semibold text-foreground">{money(sv.price)}</span>
                            {sv.oldPrice && <span className="line-through">{money(sv.oldPrice)}</span>}
                          </p>
                        </div>
                        <Link
                          href={`/salons/${salon.slug}/reserver?service=${sv.id}`}
                          className="inline-flex h-10 shrink-0 items-center rounded-full border border-plum-300 px-4 text-sm font-semibold text-plum-800 transition-colors hover:bg-primary hover:text-primary-foreground"
                          aria-label={f(s.chooseAria, { name: tc(sv.name) })}
                        >
                          {s.choose}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Équipe */}
          <section id="equipe" className="scroll-mt-36 pt-14" aria-labelledby="equipe-title">
            <h2 id="equipe-title" className="display text-3xl text-ink">
              {s.teamTitle}
            </h2>
            <ul data-animate="stagger" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {detail.employees.map((e) => (
                <li key={e.id} className="rounded-2xl border border-border bg-card p-4 text-center">
                  <Avatar className="mx-auto size-16">
                    {e.avatar && <AvatarImage src={e.avatar} alt="" />}
                    <AvatarFallback className="bg-blush text-lg font-semibold text-plum-700">{e.name[0]}</AvatarFallback>
                  </Avatar>
                  <p className="mt-3 font-semibold">{e.name}</p>
                  <p className="text-xs text-muted-foreground">{tc(e.role)}</p>
                  <Rating value={e.rating} className="mt-2 justify-center text-xs" />
                </li>
              ))}
            </ul>
          </section>

          {/* Avis */}
          <section id="avis" className="scroll-mt-36 pt-14" aria-labelledby="avis-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="avis-title" className="display text-3xl text-ink">
                {s.reviewsTitle}
              </h2>
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-plum-600" aria-hidden />
                {s.reviewsNote}
              </p>
            </div>

            <div data-animate="stagger" data-stagger="0.12" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-5xl font-semibold tracking-tight">{nf(salon.rating, { minimumFractionDigits: 1 })}</p>
                <div className="mt-1 flex gap-0.5" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-4 fill-star text-star" />
                  ))}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{f(s.reviewsCount, { n: nf(salon.reviewCount) })}</p>
                <dl className="mt-5 space-y-1.5">
                  {detail.distribution.map((d) => (
                    <div key={d.stars} className="flex items-center gap-2 text-xs">
                      <dt className="w-3 text-muted-foreground tabular-nums">{d.stars}</dt>
                      <dd className="flex flex-1 items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span data-animate="grow-x" className="block h-full rounded-full bg-star" style={{ width: `${(d.count / totalReviews) * 100}%` }} />
                        </span>
                        <span className="w-8 text-end text-muted-foreground tabular-nums">{nf(d.count)}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Résumé IA */}
              <div className="rounded-2xl bg-blush p-5 ring-1 ring-plum-200">
                <p className="flex items-center gap-2 text-sm font-semibold text-plum-800">
                  <Sparkles className="size-4" aria-hidden />
                  {s.aiSummary}
                </p>
                {aiSummary && <p className="mt-3 leading-relaxed text-foreground">{tc(aiSummary.summary)}</p>}
                {aiSummary && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.strengths}</p>
                    <ul className="mt-2 space-y-1.5">
                      {aiSummary.strengths.map((x) => (
                        <li key={x} className="flex items-start gap-2 text-sm">
                          <ThumbsUp className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden /> {tc(x)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.weaknesses}</p>
                    <ul className="mt-2 space-y-1.5">
                      {aiSummary.weaknesses.map((x) => (
                        <li key={x} className="flex items-start gap-2 text-sm">
                          <Flag className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden /> {tc(x)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                )}
                <div className="mt-5">
                  <div
                    className="flex h-2 overflow-hidden rounded-full"
                    role="img"
                    aria-label={f(s.sentimentAria, { pos: positif, neu: neutre, neg: negatif })}
                  >
                    <span className="bg-success" style={{ width: `${positif}%` }} />
                    <span className="border-x-2 border-blush bg-[#b9aab4]" style={{ width: `${neutre}%` }} />
                    <span className="bg-destructive" style={{ width: `${negatif}%` }} />
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span>
                      <span className="me-1 inline-block size-2 rounded-full bg-success" />
                      {f(s.positive, { n: positif })}
                    </span>
                    <span>
                      <span className="me-1 inline-block size-2 rounded-full bg-[#b9aab4]" />
                      {f(s.neutral, { n: neutre })}
                    </span>
                    <span>
                      <span className="me-1 inline-block size-2 rounded-full bg-destructive" />
                      {f(s.negative, { n: negatif })}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <ul data-animate="stagger" data-stagger="0.1" className="mt-6 space-y-4">
              {detail.reviews.map((r) => (
                <li key={r.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-10">
                      {r.avatar && <AvatarImage src={r.avatar} alt="" />}
                      <AvatarFallback className="bg-blush font-semibold text-plum-700">{r.author[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="font-semibold">{r.author}</p>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <BadgeCheck className="size-3.5" aria-hidden /> {s.verifiedReview}
                        </span>
                        <span className="text-xs text-muted-foreground">{df(r.date, { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex gap-0.5" role="img" aria-label={f(s.starsAria, { n: r.rating })}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("size-3.5", i < r.rating ? "fill-star text-star" : "text-border")} aria-hidden />
                          ))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tc(r.service)} · {r.employee}
                        </span>
                      </div>
                      <p className="mt-3 leading-relaxed text-foreground" lang={r.lang} dir="auto">
                        {r.text}
                      </p>
                      {locale !== r.lang && r.lang === "fr" && (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Languages className="size-3" aria-hidden /> {s.reviewOriginal}
                        </p>
                      )}
                      {r.photo && (
                        <div className="relative mt-3 size-24 overflow-hidden rounded-xl bg-muted">
                          <Image src={r.photo} alt={f(s.reviewPhotoAlt, { name: r.author })} fill sizes="96px" className="object-cover" />
                        </div>
                      )}
                      {r.reply && (
                        <div className="mt-4 rounded-xl bg-muted/70 p-3.5 text-sm">
                          <p className="flex items-center gap-1.5 font-semibold text-foreground">
                            <MessageSquareText className="size-4 text-plum-600" aria-hidden /> {s.salonReply}
                          </p>
                          <p className="mt-1 text-muted-foreground" lang="fr" dir="auto">
                            {r.reply}
                          </p>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-full px-2 hover:bg-muted hover:text-foreground">
                          <ThumbsUp className="size-3.5" aria-hidden /> {f(s.helpful, { n: r.helpful })}
                        </button>
                        <button type="button" className="inline-flex h-9 items-center gap-1 rounded-full px-2 hover:bg-muted hover:text-foreground">
                          <Flag className="size-3.5" aria-hidden /> {s.report}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Infos */}
          <section id="infos" className="scroll-mt-36 pt-14" aria-labelledby="infos-title">
            <h2 id="infos-title" className="display text-3xl text-ink">
              {s.sections.infos}
            </h2>
            <div data-animate="stagger" className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-semibold">{s.hours}</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {[1, 2, 3, 4, 5, 6, 0].map((weekday) => detail.openingHours.find((h) => h.weekday === weekday)!).map((h) => (
                    <div key={h.weekday} className={cn("flex justify-between gap-4", h.weekday === detail.today.weekday && "font-semibold text-foreground")}>
                      <dt className={cn("capitalize", h.weekday !== detail.today.weekday && "text-muted-foreground")}>
                        {df(weekdayIso(h.weekday), { weekday: "long" })}
                      </dt>
                      <dd className={h.hours ? "tabular-nums" : "text-muted-foreground"} dir="ltr">
                        {h.hours ?? s.closed}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{s.address}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{salon.address}</p>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${salon.lat}&mlon=${salon.lng}#map=17/${salon.lat}/${salon.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline"
                  >
                    <Navigation className="size-4" aria-hidden /> {s.directions}
                  </a>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="font-semibold">{s.amenities}</h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {detail.amenities.map((a) => (
                      <li key={a} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {tc(a)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Carte de réservation */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div data-animate="fade-up" className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {s.fromPrice} <span className="text-2xl font-semibold text-foreground">{money(salon.priceFrom)}</span>
              </p>
              <Rating value={salon.rating} />
            </div>
            <div className="mt-4 rounded-2xl bg-muted/70 p-3.5">
              <AffluencePill level={salon.affluence} waitMinutes={salon.waitMinutes} />
            </div>

            <p className="mt-5 text-sm font-medium">{s.nextSlotsToday}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {salon.nextSlots.map((slot) => (
                <Link
                  key={slot}
                  href={`/salons/${salon.slug}/reserver?heure=${slot}`}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-blush text-sm font-semibold text-plum-800 tabular-nums transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {slot}
                </Link>
              ))}
            </div>

            <Link
              href={`/salons/${salon.slug}/reserver`}
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-plum-800 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {s.bookSlot}
            </Link>
            <div className="mt-3 flex justify-center">
              {salon.visited ? <PointsBadge points={10} label={s.afterVisit} /> : <PointsBadge points={30} label={s.firstVisit} />}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-semibold">{s.forecastToday}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.bestTime} <span className="font-semibold text-foreground">{f(t.common.range, { from: hour(10), to: hour(12) })}</span>
              </p>
              <ForecastBars data={TODAY_FORECAST} currentIndex={1} className="mt-3" height={80} />
            </div>

            <ul className="mt-6 space-y-2 border-t border-border pt-5 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-plum-600" aria-hidden />
                {f(s.deposit, { amount: money(20) })}
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-plum-600" aria-hidden />
                {s.freeCancel}
              </li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Barre de réservation mobile / tablette */}
      <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {t.common.from} <span className="text-base font-semibold text-foreground">{money(salon.priceFrom)}</span>
            </p>
            <AffluencePill level={salon.affluence} waitMinutes={salon.waitMinutes} />
          </div>
          <Link
            href={`/salons/${salon.slug}/reserver`}
            className="inline-flex h-12 shrink-0 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
          >
            {t.common.book}
          </Link>
        </div>
      </div>
    </div>
  );
}
