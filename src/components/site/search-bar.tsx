"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronDown, LocateFixed, MapPin, Search } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const WHEN = ["any", "today", "tomorrow", "weekend", "week"] as const;
const CITY_OPTIONS = ["Tunis", "La Marsa", "Carthage", "Les Berges du Lac", "El Menzah", "Ennasr", "Sousse", "Sfax", "Hammamet", "Nabeul", "Monastir", "Bizerte"];

/**
 * Barre de recherche — le CTA principal (pattern Marketplace / Directory).
 * RES-01 : recherche par service et ville ; la date filtre sur les créneaux libres.
 */
export function SearchBar({
  variant = "hero",
  defaultQuery = "",
  defaultCity = "",
  className,
}: {
  variant?: "hero" | "compact";
  defaultQuery?: string;
  defaultCity?: string;
  className?: string;
}) {
  const { t, tc } = useI18n();
  const s = t.search;
  const router = useRouter();
  const [q, setQ] = useState(defaultQuery);
  const [city, setCity] = useState(defaultCity);
  const [when, setWhen] = useState<(typeof WHEN)[number]>("any");

  const hero = variant === "hero";

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (city === s.nearMe) params.set("proche", "1");
        else if (city) params.set("ville", city);
        if (when !== "any") params.set("quand", when);
        router.push(`/salons${params.size ? `?${params}` : ""}`);
      }}
      className={cn(
        "flex w-full flex-col gap-1 bg-card p-2 ring-1 ring-border md:flex-row md:items-center md:gap-0",
        hero ? "rounded-3xl shadow-lift md:rounded-full" : "rounded-2xl shadow-soft md:rounded-full",
        className
      )}
    >
      <label className={cn("group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 transition-colors hover:bg-muted/60 md:rounded-full", hero ? "h-14" : "h-11")}>
        <Search className="size-5 shrink-0 text-plum-600" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          {hero && <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">{s.service}</span>}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={s.servicePlaceholder}
            aria-label={s.serviceAria}
            className="w-full min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none lg:text-[15px]"
          />
        </span>
      </label>

      <span className="mx-1 hidden h-8 w-px bg-border md:block" aria-hidden />

      <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 transition-colors hover:bg-muted/60 md:rounded-full", hero ? "h-14" : "h-11")}>
        <MapPin className="size-5 shrink-0 text-plum-600" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          {hero && <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">{s.where}</span>}
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={s.wherePlaceholder}
            aria-label={s.whereAria}
            list="bh-cities"
            className="w-full min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none lg:text-[15px]"
          />
          <datalist id="bh-cities">
            {CITY_OPTIONS.map((c) => (
              <option key={c} value={c} label={tc(c)} />
            ))}
          </datalist>
        </span>
        <button
          type="button"
          onClick={() => setCity(s.nearMe)}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-plum-700"
          aria-label={s.useLocation}
          title={s.nearMe}
        >
          <LocateFixed className="size-[18px]" aria-hidden />
        </button>
      </div>

      <span className="mx-1 hidden h-8 w-px bg-border md:block" aria-hidden />

      <label className={cn("relative flex items-center gap-3 rounded-2xl px-4 transition-colors hover:bg-muted/60 md:w-52 md:rounded-full", hero ? "h-14" : "h-11")}>
        <CalendarDays className="size-5 shrink-0 text-plum-600" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          {hero && <span className="text-[11px] font-semibold tracking-wide text-foreground uppercase">{s.when}</span>}
          <select
            value={when}
            onChange={(e) => setWhen(e.target.value as (typeof WHEN)[number])}
            aria-label={s.when}
            // Toute la hauteur du champ est cliquable au doigt
            className={cn("w-full appearance-none bg-transparent pe-5 text-base text-foreground focus:outline-none lg:text-[15px]", hero ? "h-8" : "h-11")}
          >
            {WHEN.map((w) => (
              <option key={w} value={w}>
                {s.whenOptions[w]}
              </option>
            ))}
          </select>
        </span>
        <ChevronDown className="pointer-events-none absolute end-4 size-4 text-muted-foreground" aria-hidden />
      </label>

      <button
        type="submit"
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-medium text-primary-foreground transition-colors duration-200 hover:bg-plum-800 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:ms-1 md:rounded-full",
          hero ? "h-14 text-[15px]" : "h-11 text-sm"
        )}
      >
        <Search className="size-[18px]" aria-hidden />
        {s.submit}
      </button>
    </form>
  );
}
