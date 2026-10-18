"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Clock, MapPin, Sparkles, Star, TrendingDown, Zap } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Salon } from "@/lib/data";
import { cn } from "@/lib/utils";
import { AffluencePill, PointsBadge, Rating, VerifiedBadge } from "./badges";
import { FavoriteButton } from "./favorite-button";

const SalonMap = dynamic(() => import("./salon-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-muted" />,
});

const SORTS = ["recommande", "note", "prix", "distance"] as const;
type SortId = (typeof SORTS)[number];

const FILTERS = [
  { id: "today", icon: Zap },
  { id: "verified", icon: BadgeCheck },
  { id: "top", icon: Star },
  { id: "offpeak", icon: TrendingDown },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function SalonResults({
  salons,
  title,
  initialSort = "recommande",
}: {
  salons: Salon[];
  title: string;
  initialSort?: SortId;
}) {
  const { t, f, nf } = useI18n();
  const r = t.results;
  const [sort, setSort] = useState<SortId>(initialSort);
  const [filters, setFilters] = useState<Set<FilterId>>(new Set());
  const [active, setActive] = useState<string | null>(null);

  const results = useMemo(() => {
    let list = salons.filter((s) => {
      if (filters.has("verified") && !s.verified) return false;
      if (filters.has("top") && s.rating < 4.8) return false;
      if (filters.has("offpeak") && !s.offPeak) return false;
      if (filters.has("today") && s.nextSlots.length === 0) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "note") return b.rating - a.rating;
      if (sort === "prix") return a.priceFrom - b.priceFrom;
      if (sort === "distance") return a.distanceKm - b.distanceKm;
      return b.matchScore - a.matchScore;
    });
    return list;
  }, [salons, filters, sort]);

  const toggle = (id: FilterId) =>
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const select = (slug: string) => {
    setActive(slug);
    requestAnimationFrame(() =>
      document.getElementById(`salon-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="min-w-0">
        {/* Filtres : une seule rangée au-dessus des résultats */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(({ id, icon: Icon }) => {
            const on = filters.has(id);
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(id)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-plum-300 hover:bg-plum-50"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {r.filters[id]}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="display text-3xl text-ink sm:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {f(results.length > 1 ? r.countOther : r.countOne, { n: nf(results.length) })}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {r.sortBy}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className="h-10 rounded-full border border-border bg-card px-3 text-base font-medium text-foreground sm:h-9 sm:text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {SORTS.map((id) => (
                <option key={id} value={id}>
                  {r.sorts[id]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul data-animate="stagger" data-stagger="0.08" className="mt-6 space-y-4">
          {results.map((s) => (
            <li key={s.slug} id={`salon-${s.slug}`}>
              <SalonRow
                salon={s}
                active={active === s.slug}
                showReason={sort === "recommande"}
                onHover={setActive}
              />
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded-3xl border border-dashed border-border p-10 text-center">
              <p className="font-medium">{r.empty}</p>
              <button type="button" onClick={() => setFilters(new Set())} className="mt-3 text-sm font-semibold text-plum-700 hover:underline">
                {r.reset}
              </button>
            </li>
          )}
        </ul>
      </div>

      <div
        // Même affichage partout : carte compacte au-dessus de la liste sur petit écran, à côté (fixe) sur grand écran
        className="order-first h-[180px] sm:h-[300px] xl:sticky xl:top-[88px] xl:order-none xl:h-[calc(100dvh-112px)]"
      >
        <div dir="ltr" aria-label={r.mapLabel} role="region" className="relative isolate size-full overflow-hidden rounded-3xl ring-1 ring-border">
          <SalonMap salons={results} activeSlug={active} onHover={setActive} onSelect={select} />
        </div>
      </div>

    </div>
  );
}

function SalonRow({
  salon,
  active,
  showReason,
  onHover,
}: {
  salon: Salon;
  active: boolean;
  showReason: boolean;
  onHover: (slug: string | null) => void;
}) {
  const { t, tc, f, nf, money, dur } = useI18n();
  return (
    <article
      onMouseEnter={() => onHover(salon.slug)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "group relative grid overflow-hidden rounded-3xl bg-card ring-1 transition-[box-shadow,ring-color] duration-200 sm:grid-cols-[240px_minmax(0,1fr)]",
        active ? "shadow-lift ring-plum-300" : "ring-border hover:shadow-soft"
      )}
    >
      <div className="relative aspect-[16/10] bg-muted sm:aspect-auto sm:min-h-full">
        <Image src={salon.cover} alt={f(t.common.salonInterior, { name: salon.name })} fill sizes="(min-width: 640px) 240px, 100vw" className="object-cover" />
        <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
          {salon.verified && <VerifiedBadge />}
        </div>
        <FavoriteButton salonName={salon.name} salonSlug={salon.slug} initial={salon.favorite} className="absolute end-3 top-3" />
      </div>

      <div className="flex min-w-0 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              <Link
                href={`/salons/${salon.slug}`}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-3xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              >
                {salon.name}
              </Link>
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {salon.address} · {f(t.common.km, { d: nf(salon.distanceKm) })}
              </span>
            </p>
          </div>
          <Rating value={salon.rating} count={salon.reviewCount} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <AffluencePill level={salon.affluence} waitMinutes={salon.waitMinutes} />
          {!salon.visited && <PointsBadge points={30} label={t.common.newSalon} />}
          {salon.offPeak && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5 text-success" aria-hidden />
              {f(t.results.offPeak, { when: tc(salon.offPeak) })}
            </span>
          )}
        </div>

        <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
          {salon.topServices.map((sv) => (
            <li key={sv.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="truncate text-foreground">{tc(sv.name)}</span>
              <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {dur(sv.duration)}
                </span>
                <span className="font-semibold text-foreground">{money(sv.price)}</span>
              </span>
            </li>
          ))}
        </ul>

        {showReason && (
          <p className="flex gap-2 text-[13px] leading-snug text-plum-800">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{t.common.whySalon}</span> {tc(salon.aiReason)}
            </span>
          </p>
        )}

        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span className="me-1 text-xs font-medium text-muted-foreground">{t.common.today}</span>
          {salon.nextSlots.map((slot) => (
            <Link
              key={slot}
              href={`/salons/${salon.slug}/reserver?heure=${slot}`}
              className="inline-flex h-10 items-center rounded-xl bg-blush px-3 text-sm font-semibold text-plum-800 tabular-nums transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {slot}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
