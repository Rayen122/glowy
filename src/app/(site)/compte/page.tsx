import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, CircleCheck, Clock, MapPin, Navigation, PenLine, Repeat, ScanFace, Star, UserPlus, UserRound } from "lucide-react";
import { TierProgress } from "@/components/loyalty/tier-progress";
import { SalonCard } from "@/components/salon/salon-card";
import { getI18n } from "@/i18n/server";
import { tierFor } from "@/lib/data";
import { getAccountSummary, lastPhotoAnalysis } from "@/modules/account";
import { recommendedSalons } from "@/modules/catalog";
import { requirePageUser } from "@/infrastructure/session";
import { tunisToday, utcToTunis } from "@/core/domain/time";

export default async function ComptePage() {
  const user = await requirePageUser();
  const [{ t, tc, f, nf, money, df }, { profile, account, bookings, next, toReview }, reco, lastAnalysis] = await Promise.all([
    getI18n(),
    getAccountSummary(user.id),
    recommendedSalons(3, user.id, { excludeVisited: true }),
    lastPhotoAnalysis(user.id),
  ]);
  const o = t.account.overview;
  const today = tunisToday();
  const again = bookings.filter((b) => b.status === "COMPLETED").slice(0, 3);
  const longDate = (iso: string) => df(iso, { weekday: "long", day: "numeric", month: "long" });
  const services = (b: (typeof bookings)[number]) => b.items.map((i) => tc(i.name)).join(" + ");
  const profileDone = Boolean(profile.phone && profile.city && profile.birthDate);

  const todos = [
    toReview
      ? {
          icon: Star,
          title: f(o.reviewTitle, { salon: toReview.salon.name }),
          text: `${services(toReview)}, ${longDate(toReview.local.date)}`,
          pts: 15,
          cta: o.reviewCta,
          href: "/compte/rendez-vous",
        }
      : null,
    profileDone ? null : { icon: UserRound, title: o.profileTitle, text: o.profileText, pts: 20, cta: o.profileCta, href: "/compte" },
    { icon: UserPlus, title: o.referTitle, text: f(o.referText, { code: profile.referralCode }), pts: 50, cta: o.referCta, href: "/compte/fidelite#parrainage" },
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{longDate(today)}</p>
        <h1 data-animate="split" className="display mt-1 text-4xl text-ink sm:text-5xl">
          {f(o.hello, { name: profile.firstName })}
        </h1>
      </header>

      <div data-animate="stagger" data-stagger="0.12" className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Prochain rendez-vous */}
        <section aria-labelledby="next-title" className="overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          {next ? (
            <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
              <div className="relative aspect-[16/9] bg-muted sm:aspect-auto">
                {next.salon.coverUrl && <Image src={next.salon.coverUrl} alt="" fill sizes="(min-width: 640px) 200px, 100vw" className="object-cover" />}
              </div>
              <div className="min-w-0 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="next-title" className="text-sm font-semibold text-muted-foreground">
                    {o.nextTitle}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
                    <CircleCheck className="size-3.5" aria-hidden /> {t.account.status[next.status === "PENDING" ? "en_attente" : "confirme"]}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-ink first-letter:uppercase">{f(t.booking.at, { date: longDate(next.local.date), time: next.local.time })}</p>
                <p className="mt-1 font-medium">
                  {services(next)} <span className="font-normal text-muted-foreground">{f(o.withName, { name: next.employee.name })}</span>
                </p>
                <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {next.salon.name}, {next.salon.address}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {(() => {
                    const deadline = utcToTunis(new Date(next.startsAt.getTime() - next.salon.cancellationHours * 3_600_000));
                    return f(o.payLine, {
                      price: money(next.totalPrice),
                      deposit: money(next.deposit),
                      deadline: f(t.booking.at, { date: df(deadline.date, { weekday: "long", day: "numeric", month: "long" }), time: deadline.time }),
                    });
                  })()}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${next.salon.lat}&mlon=${next.salon.lng}#map=17/${next.salon.lat}/${next.salon.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
                  >
                    <Navigation className="size-4" aria-hidden /> {t.salon.directions}
                  </a>
                  <Link
                    href={`/salons/${next.salon.slug}/reserver`}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted"
                  >
                    <CalendarClock className="size-4" aria-hidden /> {o.reschedule}
                  </Link>
                  <Link href="/compte/rendez-vous" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-destructive hover:bg-danger-soft">
                    {o.cancel}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
              <h2 id="next-title" className="text-sm font-semibold text-muted-foreground">
                {o.nextTitle}
              </h2>
              <p className="text-lg font-semibold">{o.noUpcoming}</p>
              <Link href="/salons" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
                {t.footer.findSalon} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          )}
        </section>

        {/* Points */}
        <section aria-labelledby="points-title" className="flex flex-col rounded-3xl bg-ink p-6 text-white">
          <div className="flex items-center justify-between">
            <h2 id="points-title" className="text-sm font-semibold text-white/75">
              {o.pointsTitle}
            </h2>
            <span className="rounded-full bg-[#e9c979] px-2.5 py-0.5 text-xs font-bold text-[#3a2a06]">{tc(tierFor(account.lifetime).label)}</span>
          </div>
          <p className="mt-3 text-5xl font-semibold tracking-tight">
            <span data-animate="count">{nf(account.balance)}</span>
            <span className="ms-1 text-lg text-white/60">{t.common.pts}</span>
          </p>
          <p className="text-sm text-white/65">{f(o.discounts, { amount: money(Math.floor(account.balance / 100) * 5) })}</p>
          <TierProgress lifetime={account.lifetime} invert className="mt-6" />
          <Link href="/compte/fidelite" className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold hover:underline">
            {o.redeem} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </section>
      </div>

      {/* À faire */}
      <section aria-labelledby="todo-title">
        <h2 id="todo-title" className="text-lg font-semibold">
          {o.earnTitle}
        </h2>
        <ul data-animate="stagger" className="mt-4 grid gap-3 md:grid-cols-3">
          {todos.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex flex-col rounded-3xl bg-card p-5 ring-1 ring-border">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-blush text-plum-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-bold text-gold">{f(t.common.plusPoints, { n: item.pts })}</span>
                </div>
                <p className="mt-4 font-semibold">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.text}</p>
                <Link href={item.href} className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline">
                  <PenLine className="size-4" aria-hidden /> {item.cta}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Refaire */}
      <section aria-labelledby="again-title">
        <h2 id="again-title" className="text-lg font-semibold">
          {o.againTitle}
        </h2>
        <ul data-animate="stagger" data-stagger="0.06" className="mt-4 divide-y divide-border overflow-hidden rounded-3xl bg-card ring-1 ring-border">
          {again.map((b) => {
            const s = b.salon;
            return (
              <li key={b.id} className="flex items-center gap-3 p-4 sm:gap-4">
                <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {s.coverUrl && <Image src={s.coverUrl} alt="" fill sizes="48px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{services(b)}</p>
                  <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                    <span className="truncate">
                      {s.name} · {f(o.withName, { name: b.employee.name })} ·
                    </span>
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    <span className="shrink-0">{df(b.local.date, { day: "numeric", month: "short" })}</span>
                  </p>
                </div>
                <Link
                  href={`/salons/${s.slug}/reserver`}
                  aria-label={`${o.again} — ${services(b)}`}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-plum-300 px-3 text-sm font-semibold text-plum-800 hover:bg-primary hover:text-primary-foreground sm:px-4"
                >
                  <Repeat className="size-4" aria-hidden />
                  <span>{o.again}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Dernière analyse */}
      <section
        data-animate="fade-up"
        aria-labelledby="analysis-title"
        className="flex flex-col gap-4 rounded-3xl bg-blush p-6 ring-1 ring-plum-200 sm:flex-row sm:items-center"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card text-plum-700">
          <ScanFace className="size-6" aria-hidden />
        </span>
        <div className="flex-1">
          <h2 id="analysis-title" className="font-semibold text-plum-900">
            {lastAnalysis ? f(o.lastAnalysis, { date: df(utcToTunis(lastAnalysis.createdAt).date, { day: "numeric", month: "long" }) }) : t.home.ai.photo.title}
          </h2>
          <p className="text-sm text-plum-800">{lastAnalysis ? o.lastAnalysisText : t.analysis.monthlyPoints}</p>
        </div>
        <Link href="/analyse-beaute" className="inline-flex h-10 items-center justify-center rounded-full bg-card px-4 text-sm font-semibold text-plum-800 hover:bg-plum-50">
          {o.newAnalysis}
        </Link>
      </section>

      {/* Recommandations */}
      <section aria-labelledby="reco-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="reco-title" className="text-lg font-semibold">
            {f(o.recoTitle, { pts: f(t.common.plusPoints, { n: 30 }) })}
          </h2>
          <Link href="/salons" className="shrink-0 text-sm font-semibold text-plum-700 hover:underline">
            {o.seeAll}
          </Link>
        </div>
        <div data-animate="stagger" data-stagger="0.1" className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 mt-4 sm:grid-cols-2 2xl:grid-cols-3">
          {reco.map((s) => (
            <SalonCard key={s.slug} salon={s} showReason className="w-[80%] max-w-[320px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
          ))}
        </div>
      </section>
    </div>
  );
}
