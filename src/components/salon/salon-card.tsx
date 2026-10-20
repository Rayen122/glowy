"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/client";
import type { Salon } from "@/lib/data";
import { cn } from "@/lib/utils";
import { recoText } from "@/lib/reco";
import { AffluencePill, PointsBadge, Rating, VerifiedBadge } from "./badges";
import { FavoriteButton } from "./favorite-button";

/** Carte verticale — carrousels et grilles */
export function SalonCard({
  salon,
  showReason,
  className,
  priority,
}: {
  salon: Salon;
  showReason?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const i18n = useI18n();
  const { t, tc, f, money } = i18n;
  const reason = recoText(i18n, salon);
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-shadow duration-200 hover:shadow-lift",
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <Image
          src={salon.cover}
          alt={f(t.common.salonInterior, { name: salon.name })}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 320px, (min-width: 768px) 45vw, 90vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute start-3 top-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5">
          {salon.verified && <VerifiedBadge />}
          {!salon.visited && <PointsBadge points={30} label={t.common.newSalon} className="bg-white/95" />}
        </div>
        <FavoriteButton salonName={salon.name} salonSlug={salon.slug} initial={salon.favorite} className="absolute end-3 top-3" />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="leading-snug font-semibold text-foreground">
            <Link
              href={`/salons/${salon.slug}`}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            >
              {salon.name}
            </Link>
          </h3>
          <Rating value={salon.rating} count={salon.reviewCount} className="shrink-0" />
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {salon.specialties.slice(0, 2).map(tc).join(" · ")} — {tc(salon.city)}
          </span>
        </p>

        {showReason && reason && (
          <p className="mt-1 flex gap-2 rounded-xl bg-blush px-3 py-2 text-[13px] leading-snug text-plum-800">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{t.common.whySalon}</span> {reason}
            </span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <AffluencePill level={salon.affluence} waitMinutes={salon.waitMinutes} />
          <span className="text-sm text-muted-foreground">
            {t.common.from} <span className="font-semibold text-foreground">{money(salon.priceFrom)}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
