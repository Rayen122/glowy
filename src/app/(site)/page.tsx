import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  ChartColumn,
  Check,
  Clock,
  CreditCard,
  Lock,
  MessageCircle,
  ScanFace,
  ShieldCheck,
  Sparkle,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { HeroMotion } from "@/components/motion/hero-motion";
import { TiltCard } from "@/components/motion/tilt-card";
import { AffluencePill, VerifiedBadge } from "@/components/salon/badges";
import { SalonCard } from "@/components/salon/salon-card";
import { SearchBar } from "@/components/site/search-bar";
import { SectionHeading } from "@/components/site/section-heading";
import type { I18n } from "@/i18n/format";
import { auth } from "@/auth";
import { getI18n } from "@/i18n/server";
import { CATEGORIES, CITIES, IMAGES, TIERS, TODAY_FORECAST } from "@/lib/data";
import { recommendedSalons } from "@/modules/catalog";
import { cn } from "@/lib/utils";

const POPULAR = ["Brushing", "Balayage", "Manucure semi-permanent", "Hammam", "Taille de barbe"];

export default async function HomePage() {
  const i18n = await getI18n();
  const { t, f, nf } = i18n;
  const h = t.home;
  const session = await auth();
  const recommended = await recommendedSalons(4, session?.user.id);

  return (
    <>
      <Hero i18n={i18n} />

      {/* Catégories */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="categories-title">
        <SectionHeading
          eyebrow={h.categories.eyebrow}
          title={<span id="categories-title">{h.categories.title}</span>}
          action={{ href: "/salons", label: h.categories.action }}
        />
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6" data-animate="stagger" data-stagger="0.07">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link
                href={`/salons?categorie=${c.id}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-2xl bg-muted focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" aria-hidden />
                <span className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                  <span className="block text-base leading-tight font-semibold tracking-tight sm:text-lg">{t.categories[c.id]}</span>
                  <span className="mt-0.5 block text-xs text-white/80">{f(t.common.salonsCount, { n: nf(c.count) })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Recommandations IA */}
      <section className="container-page pb-16 lg:pb-24" aria-labelledby="reco-title">
        <SectionHeading
          eyebrow={h.reco.eyebrow}
          title={
            <span id="reco-title">
              {h.reco.titleStart} <em className="text-plum-600">{h.reco.titleEm}</em>
            </span>
          }
          description={h.reco.description}
          action={{ href: "/salons?tri=recommande", label: h.reco.action }}
        />
        {/* Mobile : carrousel horizontal (glisser) ; grille à partir de sm */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 mt-10 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4" data-animate="stagger" data-stagger="0.1">
          {recommended.map((s, i) => (
            <SalonCard key={s.slug} salon={s} showReason priority={i < 2} className="w-[80%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
          ))}
        </div>
      </section>

      <AiSection i18n={i18n} />
      <TrustSection i18n={i18n} />
      <LoyaltySection i18n={i18n} />
      <ProSection i18n={i18n} />

      {/* Villes */}
      <section className="container-page py-16 lg:py-24" aria-labelledby="villes-title">
        <SectionHeading eyebrow={h.cities.eyebrow} title={<span id="villes-title">{h.cities.title}</span>} />
        <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4" data-animate="stagger" data-stagger="0.05">
          {CITIES.map((c) => (
            <li key={c.name}>
              <Link
                href={`/salons?ville=${encodeURIComponent(c.name)}`}
                className="group flex min-h-16 items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-4 transition-colors duration-200 hover:border-plum-300 hover:bg-plum-50 sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{i18n.tc(c.name)}</span>
                  <span className="text-sm text-muted-foreground">{f(t.common.salonsCount, { n: nf(c.salons) })}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-plum-700 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Hero({ i18n }: { i18n: I18n }) {
  const { t, tc, f, nf, hour } = i18n;
  const h = t.home.hero;
  const peak = Math.max(...TODAY_FORECAST.map((x) => x.value));
  return (
    <section className="relative overflow-hidden">
      <HeroMotion>
        <div
          className="pointer-events-none absolute -end-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(closest-side,#f6e8f1,transparent)]"
          aria-hidden
        />
        <div className="container-page relative grid grid-cols-1 items-center gap-10 pt-8 pb-8 sm:gap-12 sm:pb-10 lg:grid-cols-[1.05fr_0.95fr] lg:pt-14 lg:pb-6">
          <div className="max-w-2xl">
            <p data-hero="badge" className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-border">
              <BadgeCheck className="size-4 shrink-0 text-plum-600" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">
                  {i18n.rich(h.badgeStrong, { count: <span key="c" data-animate="count">{nf(1342)}</span> })}
                </span>{" "}
                {h.badgeRest}
              </span>
            </p>
            <h1 data-hero="title" className="display mt-6 text-[2.6rem] text-ink sm:text-6xl lg:text-7xl">
              {h.titleStart} <em className="text-plum-600">{h.titleEm}</em>
            </h1>
            <p data-hero="lead" className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {h.lead}
            </p>
            <dl data-hero="stats" className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-border pt-6 sm:gap-6">
              {[
                { k: h.statRating, v: `${nf(4.8, { minimumFractionDigits: 1 })}/5` },
                { k: h.statReviews, v: nf(96000) },
                { k: h.statDoubles, v: "0" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-xs text-muted-foreground">{s.k}</dt>
                  <dd className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl" data-animate="count" dir="ltr">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Collage */}
          <div className="relative mx-auto aspect-[5/5.2] w-full max-w-[440px] sm:max-w-[560px]" data-speed="7">
            <div data-hero="arch" className="arch absolute end-0 top-0 h-[92%] w-[72%] overflow-hidden bg-muted">
              <Image src={IMAGES.heroPortrait} alt={h.portraitAlt} fill priority sizes="(min-width: 1024px) 400px, 60vw" className="object-cover" />
            </div>
            <div
              data-hero="side"
              data-speed="-16"
              className="absolute start-0 bottom-0 h-[44%] w-[42%] overflow-hidden rounded-3xl bg-muted ring-8 ring-background"
            >
              <Image src={IMAGES.heroSalon} alt={h.salonAlt} fill loading="eager" sizes="240px" className="object-cover" />
            </div>

            {/* Carte créneau */}
            <div data-hero="card" className="absolute start-0 top-6 w-[13.5rem] rounded-2xl bg-card/95 p-3 shadow-lift ring-1 ring-border backdrop-blur sm:start-2 sm:top-10 sm:w-64 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Salon Yasmine</p>
                <VerifiedBadge compact className="ring-0" />
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="size-3.5 fill-star text-star" aria-hidden /> {nf(4.9, { minimumFractionDigits: 1 })} · {tc("La Marsa")}
              </p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">{t.salon.nextSlotsToday}</p>
              <div className="mt-1.5 flex gap-1.5">
                {["14:00", "14:45", "16:30"].map((slot, i) => (
                  <span
                    key={slot}
                    className={cn("rounded-lg px-2 py-1 text-xs font-semibold tabular-nums sm:px-2.5", i === 0 ? "bg-primary text-primary-foreground" : "bg-blush text-plum-800")}
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </div>

            {/* Carte affluence */}
            <div data-hero="card" className="absolute end-0 top-[44%] w-44 rounded-2xl bg-card/95 p-3 shadow-lift ring-1 ring-border backdrop-blur sm:end-[-8px] sm:top-[46%] sm:w-56 sm:p-4">
              <AffluencePill level="calme" waitMinutes={0} />
              <div className="mt-2 flex h-9 items-end gap-1 sm:mt-3 sm:h-12" aria-hidden data-animate="grow-y" dir="ltr">
                {TODAY_FORECAST.map((x, i) => (
                  <span
                    key={x.hour}
                    className={cn("w-full rounded-t-[3px]", i === 1 ? "bg-plum-600" : "bg-plum-200")}
                    style={{ height: `${(x.value / peak) * 100}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t.salon.bestTime} <span className="font-semibold text-foreground">{f(t.common.range, { from: hour(10), to: hour(12) })}</span>
              </p>
            </div>

            {/* Carte points */}
            <div data-hero="card" className="absolute end-2 bottom-1 flex max-w-[230px] items-center gap-2.5 rounded-2xl bg-ink px-3 py-2.5 text-white shadow-lift sm:end-10 sm:bottom-4 sm:max-w-[260px] sm:gap-3 sm:px-4 sm:py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
                <Sparkle className="size-4 fill-current" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-semibold">{f(h.pointsTitle, { n: 30 })}</span>
                <span className="block text-xs text-white/70">{h.pointsText}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="container-page relative pb-6">
          <div data-hero="search">
            <SearchBar />
          </div>
          <p data-hero="chips" className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{h.popular}</span>
            {POPULAR.map((p) => (
              <Link
                key={p}
                href={`/salons?q=${encodeURIComponent(p)}`}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 py-1 text-foreground transition-colors hover:border-plum-300 hover:bg-plum-50"
              >
                {tc(p)}
              </Link>
            ))}
          </p>
        </div>
      </HeroMotion>
    </section>
  );
}

function AiSection({ i18n }: { i18n: I18n }) {
  const { t, f, nf, rich } = i18n;
  const a = t.home.ai;
  return (
    <section className="bg-ink py-16 text-white lg:py-24" aria-labelledby="ia-title">
      <div className="container-page">
        <SectionHeading
          invert
          eyebrow={a.eyebrow}
          title={
            <span id="ia-title">
              {a.titleStart} <em className="text-plum-200">{a.titleEm}</em>
            </span>
          }
          description={a.description}
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2" data-animate="stagger" data-stagger="0.12">
          {/* Analyse photo */}
          <article className="relative flex min-h-[380px] flex-col overflow-hidden rounded-3xl bg-plum-900 sm:min-h-[420px] md:col-span-2 lg:col-span-1 lg:row-span-2">
            <Image src={IMAGES.analysisSample} alt="" fill sizes="(min-width:1024px) 33vw, 100vw" className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-plum-900 via-plum-900/40 to-transparent" aria-hidden />
            {/* Cadre de scan */}
            <div className="absolute inset-x-10 top-10 h-48" aria-hidden>
              {[
                "start-0 top-0 border-s-2 border-t-2 rounded-ss-xl",
                "end-0 top-0 border-e-2 border-t-2 rounded-se-xl",
                "start-0 bottom-0 border-s-2 border-b-2 rounded-es-xl",
                "end-0 bottom-0 border-e-2 border-b-2 rounded-ee-xl",
              ].map((c) => (
                <span key={c} className={cn("absolute size-8 border-white/80", c)} />
              ))}
            </div>
            <div className="relative mt-auto space-y-4 p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                <ScanFace className="size-3.5" aria-hidden /> {a.photo.badge}
              </span>
              <h3 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{a.photo.title}</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {a.photo.chips.map((c) => (
                  <span key={c} className="rounded-full bg-white/90 px-2.5 py-1 font-medium text-plum-800">
                    {c}
                  </span>
                ))}
              </div>
              <Link
                href="/analyse-beaute"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-plum-100"
              >
                {a.photo.cta} <span className="text-plum-600">{f(t.common.plusPoints, { n: 10 })}</span>
              </Link>
            </div>
          </article>

          {/* Chatbot */}
          <article className="flex flex-col rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <IconTitle icon={<MessageCircle className="size-4" />} title={a.chat.title} />
            <div className="mt-5 space-y-2 text-sm" data-animate="stagger" data-stagger="0.6">
              <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-md bg-plum-600 px-3.5 py-2">{a.chat.userMsg}</p>
              <p className="w-fit max-w-[85%] rounded-2xl rounded-es-md bg-white/10 px-3.5 py-2 text-white/90">{a.chat.botMsg}</p>
            </div>
            <p className="mt-auto pt-5 text-sm text-white/65">{a.chat.note}</p>
          </article>

          {/* Affluence */}
          <article className="flex flex-col rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <IconTitle icon={<TrendingUp className="size-4" />} title={a.forecast.title} />
            <div className="mt-5 flex h-20 items-end gap-1.5" aria-hidden data-animate="grow-y" dir="ltr">
              {TODAY_FORECAST.map((x) => (
                <span key={x.hour} className={cn("w-full rounded-t-[4px]", x.value < 35 ? "bg-emerald-300" : "bg-white/25")} style={{ height: `${x.value}%` }} />
              ))}
            </div>
            <p className="mt-auto pt-5 text-sm text-white/65">
              {rich(a.forecast.note, { pts: <span key="p" className="font-semibold text-white">{f(t.common.plusPoints, { n: 10 })}</span> })}
            </p>
          </article>

          {/* Analyse des avis */}
          <article className="flex flex-col rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <IconTitle icon={<Star className="size-4" />} title={a.reviews.title} />
            <p className="mt-5 text-4xl font-semibold tracking-tight" data-animate="count" dir="ltr">
              86 %
            </p>
            <p className="text-sm text-white/65">{f(a.reviews.caption, { n: nf(238) })}</p>
            <p className="mt-auto pt-5 text-sm text-white/65">{a.reviews.note}</p>
          </article>

          {/* Recommandation */}
          <article className="flex flex-col rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <IconTitle icon={<Sparkles className="size-4" />} title={a.reco.title} />
            <div className="mt-5 flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-semibold text-plum-700" data-animate="count">
                96
              </span>
              <span className="text-sm text-white/80">
                {rich(a.reco.text, { pct: <span key="p" className="font-semibold text-white">96 %</span> })}
              </span>
            </div>
            <p className="mt-auto pt-5 text-sm text-white/65">{a.reco.note}</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function IconTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      {title}
    </h3>
  );
}

function TrustSection({ i18n }: { i18n: I18n }) {
  const tr = i18n.t.home.trust;
  const icons = [ShieldCheck, BadgeCheck, CalendarCheck, Lock];
  return (
    <section className="container-page py-16 lg:py-24" aria-labelledby="trust-title">
      <SectionHeading align="center" eyebrow={tr.eyebrow} title={<span id="trust-title">{tr.title}</span>} />
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-animate="stagger" data-stagger="0.1">
        {tr.items.map((item, i) => {
          const Icon = icons[i];
          return (
            <li key={item.title} className="rounded-3xl border border-border bg-card p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-blush text-plum-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function LoyaltySection({ i18n }: { i18n: I18n }) {
  const { t, tc, f, nf } = i18n;
  const l = t.home.loyalty;
  return (
    <section className="bg-sand/70 py-16 lg:py-24" aria-labelledby="fidelite-title">
      <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow={l.eyebrow}
            title={
              <span id="fidelite-title">
                {l.titleStart} <em className="text-plum-600">{l.titleEm}</em>
              </span>
            }
            description={l.description}
          />
          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" data-animate="stagger" data-stagger="0.08">
            {l.earn.map((e) => (
              <li key={e.label} className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                <span className="w-12 shrink-0 text-lg font-semibold text-gold" dir="ltr">
                  {e.pts}
                </span>
                <span className="text-sm text-foreground">{e.label}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/compte/fidelite"
            data-animate="fade-up"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-plum-800"
          >
            {l.cta}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>

        {/* Carte membre */}
        <div className="mx-auto w-full max-w-md" data-animate="pop">
          <TiltCard className="relative aspect-[1.586] overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#3a1532_0%,#6b2a5c_55%,#8e3b7e_100%)] p-5 text-white shadow-lift sm:p-7">
            <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full border border-white/15" aria-hidden />
            <div className="pointer-events-none absolute -end-6 -top-6 size-36 rounded-full border border-white/10" aria-hidden />
            <div className="flex items-start justify-between">
              <span className="text-xl font-bold tracking-tight" dir="ltr">
                Glowy
              </span>
              <span className="rounded-full bg-[#e9c979] px-3 py-1 text-xs font-bold tracking-wide text-[#3a2a06] uppercase">{tc("Or")}</span>
            </div>
            <div className="absolute inset-x-5 bottom-5 sm:inset-x-7 sm:bottom-7">
              <p className="text-xs text-white/70">{l.card.balance}</p>
              <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
                <span data-animate="count">{nf(420)}</span> {t.common.pts}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-white/75 sm:mt-4">
                <span>{l.card.member}</span>
                <span>{f(l.card.progress, { cur: nf(640), max: nf(1000), tier: tc("Platine") })}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-[64%] rounded-full bg-[#e9c979]" data-animate="grow-x" />
              </div>
            </div>
          </TiltCard>
          <ol className="mt-6 grid grid-cols-4 gap-2 text-center text-xs" data-animate="stagger" data-stagger="0.08">
            {TIERS.map((tier) => (
              <li
                key={tier.id}
                className={cn(
                  "rounded-xl px-1 py-2.5 ring-1 sm:px-2",
                  tier.id === "or" ? "bg-card font-semibold text-foreground ring-plum-300" : "text-muted-foreground ring-border"
                )}
              >
                <span className="block truncate">{tc(tier.label)}</span>
                <span className="block text-[11px] font-normal text-muted-foreground">{f(l.tierMin, { n: nf(tier.min) })}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ProSection({ i18n }: { i18n: I18n }) {
  const { t, tc, f, money } = i18n;
  const p = t.home.pro;
  return (
    <section className="container-page pt-16 lg:pt-24" aria-labelledby="pro-title">
      <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] bg-blush lg:grid-cols-2">
        <div className="p-6 sm:p-12 lg:p-14">
          <p className="eyebrow inline-flex items-center gap-2">
            <Store className="size-4" aria-hidden /> {p.eyebrow}
          </p>
          <h2 id="pro-title" data-animate="split" className="display mt-4 text-3xl text-ink sm:text-4xl lg:text-5xl">
            {p.titleStart} <em className="text-plum-600">{p.titleEm}</em>
          </h2>
          <ul className="mt-8 space-y-3" data-animate="stagger" data-stagger="0.08">
            {p.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" aria-hidden />
                </span>
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap" data-animate="fade-up">
            <Link
              href="/inscription?type=salon"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-plum-800"
            >
              {p.ctaRegister}
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-full border border-plum-300 bg-card px-6 text-sm font-semibold text-plum-800 transition-colors hover:bg-plum-50"
            >
              {p.ctaDemo}
            </Link>
          </div>
        </div>

        {/* Aperçu dashboard */}
        <div className="relative px-4 pb-6 sm:px-12 sm:pb-12 lg:min-h-[460px] lg:p-0">
          <div
            className="relative overflow-hidden rounded-3xl bg-card shadow-lift ring-1 ring-border lg:absolute lg:inset-y-10 lg:start-0 lg:end-10"
            data-animate="pop"
          >
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2.5 rounded-full bg-[#e5d9d4]" />
              ))}
              <span className="ms-3 text-xs text-muted-foreground" dir="ltr">
                glowy.tn/dashboard
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-5">
              {[
                { icon: CalendarCheck, k: p.mock.today, v: "18" },
                { icon: CreditCard, k: p.mock.revenue, v: money(1240) },
                { icon: ChartColumn, k: p.mock.fill, v: "78 %" },
              ].map(({ icon: Icon, k, v }) => (
                <div key={k} className="min-w-0 rounded-2xl border border-border p-2.5 sm:p-3">
                  <Icon className="size-4 text-plum-600" aria-hidden />
                  <p className="mt-2 truncate text-[11px] text-muted-foreground">{k}</p>
                  <p className="truncate text-base font-semibold sm:text-lg" data-animate="count">
                    {v}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 px-3 sm:px-5" data-animate="stagger" data-stagger="0.15">
              {[
                { time: "10:00", n: "Mouna G.", s: "Chignon de mariée", c: "bg-series-2" },
                { time: "11:30", n: "Sarra B.", s: "Balayage", c: "bg-series-1" },
                { time: "14:30", n: "Asma R.", s: "Coupe + brushing", c: "bg-series-2" },
                { time: "15:00", n: "Emna Z.", s: "Soin kératine", c: "bg-series-3" },
              ].map((r) => (
                <div key={r.time + r.n} className="flex items-center gap-2.5 rounded-xl border border-border px-3 py-2.5 sm:gap-3">
                  <span className={cn("h-8 w-1 shrink-0 rounded-full", r.c)} />
                  <span className="w-10 shrink-0 text-xs font-semibold tabular-nums sm:w-12">{r.time}</span>
                  <span className="truncate text-sm font-medium">{r.n}</span>
                  <span className="ms-auto truncate text-xs text-muted-foreground">{tc(r.s)}</span>
                </div>
              ))}
            </div>
            <div className="m-3 flex items-center gap-3 rounded-2xl bg-plum-50 p-3 text-xs text-plum-800 sm:m-5 sm:text-sm">
              <Users className="size-4 shrink-0" aria-hidden />
              {f(p.mock.alert, { day: t.home.pro.mock.saturday })}
              <Clock className="ms-auto size-4 shrink-0" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
