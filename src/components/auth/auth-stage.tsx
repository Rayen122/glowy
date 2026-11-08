"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { BadgeCheck, CalendarCheck, Sparkle, Star } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/i18n/client";
import { CATEGORIES, IMAGES, img } from "@/lib/data";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

const COLUMNS = [
  [CATEGORIES[0].image, IMAGES.heroPortrait, img("photo-1781450090585-1a511b7066d9", 600), CATEGORIES[2].image],
  [CATEGORIES[3].image, img("photo-1709477542149-f4e0e21d590b", 600), CATEGORIES[1].image, img("photo-1786937680099-779e1da6f7f7", 600)],
  [CATEGORIES[4].image, img("photo-1675034741473-afed58a142e8", 600), CATEGORIES[5].image, img("photo-1632345031435-8727f6897d53", 600)],
];

/** Événement émis par le formulaire après une connexion réussie */
export const AUTH_SUCCESS_EVENT = "bh:auth-success";

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      data-chip
      className={cn(
        "absolute z-20 hidden items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap text-white shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/20 backdrop-blur-md sm:inline-flex",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Scène visuelle de l'authentification : l'arche (miroir de salon) laisse voir des colonnes
 * de photos qui défilent, entourée de puces flottantes et d'un titre à mots tournants.
 */
/** Chiffres réels passés par la mise en page serveur (salons vérifiés, salon le mieux noté) */
export function AuthStage({ verifiedSalons, topSalon }: { verifiedSalons: number; topSalon: { name: string; rating: number } | null }) {
  const { t, f, nf } = useI18n();
  const st = t.auth.stage;
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const $ = (sel: string) => gsap.utils.toArray<HTMLElement>(sel, root);
        const arch = $("[data-arch]");
        const line = $("[data-arch-line] path");
        const chips = $("[data-chip]");

        // Arrivée
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro
          .from($("[data-orb]"), { autoAlpha: 0, scale: 0.6, duration: 1.8, stagger: 0.2 }, 0)
          .fromTo(arch, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.out" }, 0.1)
          .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut" }, 0.3)
          .from(chips, { autoAlpha: 0, scale: 0.7, y: 24, duration: 0.9, stagger: 0.14, ease: "back.out(1.8)" }, 0.9)
          .from($("[data-intro]"), { autoAlpha: 0, y: 28, duration: 1, stagger: 0.12 }, 0.5)
          .from($("[data-chip-row]"), { autoAlpha: 0, x: 24, duration: 0.7, stagger: 0.08 }, 0.8);

        // Colonnes de photos en boucle infinie (sens alternés)
        const loops = $("[data-col]").map((col, i) =>
          gsap.fromTo(
            col,
            { yPercent: i % 2 ? -50 : 0 },
            { yPercent: i % 2 ? 0 : -50, duration: 36 + i * 6, ease: "none", repeat: -1 }
          )
        );

        // Puces et lueurs qui flottent
        chips.forEach((chip, i) =>
          gsap.to(chip, {
            y: i % 2 ? 10 : -10,
            x: i % 3 ? 4 : -4,
            rotation: i % 2 ? 1.5 : -1.5,
            duration: 3 + i * 0.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 1.6,
          })
        );
        $("[data-orb]").forEach((orb, i) =>
          gsap.to(orb, { xPercent: i ? -18 : 22, yPercent: i ? -14 : 16, duration: 14 + i * 3, ease: "sine.inOut", yoyo: true, repeat: -1 })
        );

        // Mots tournants
        const words = $("[data-word]");
        if (words.length > 1) {
          gsap.set(words, { yPercent: 105, autoAlpha: 0 });
          gsap.set(words[0], { yPercent: 0, autoAlpha: 1 });
          const rot = gsap.timeline({ repeat: -1, delay: 1.2 });
          words.forEach((w, i) => {
            const next = words[(i + 1) % words.length];
            rot
              .to(w, { yPercent: -105, autoAlpha: 0, duration: 0.55, ease: "power3.in" }, "+=1.8")
              .fromTo(
                next,
                { yPercent: 105, autoAlpha: 0 },
                { yPercent: 0, autoAlpha: 1, duration: 0.65, ease: "power3.out", immediateRender: false },
                "-=0.2"
              );
          });
        }

        // Connexion réussie : la scène accélère
        const onSuccess = () => {
          gsap.to(loops, { timeScale: 9, duration: 1.2, ease: "power2.in" });
          gsap.to(arch, { scale: 1.06, duration: 1.2, ease: "power2.inOut" });
          gsap.to(chips, { autoAlpha: 0, y: -20, duration: 0.5, stagger: 0.05 });
        };
        window.addEventListener(AUTH_SUCCESS_EVENT, onSuccess);
        return () => window.removeEventListener(AUTH_SUCCESS_EVENT, onSuccess);
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  const verified = (
    <>
      <BadgeCheck className="size-3.5" aria-hidden /> {f(st.verified, { n: nf(verifiedSalons) })}
    </>
  );
  /** Puces flottantes autour de l'arche (≥ sm) ; sur téléphone, mêmes puces en rangée sous le titre */
  const chips = [
    {
      id: "rating",
      pos: "-start-16 top-[16%]",
      content: (
        <>
          <Star className="size-4 fill-[#e9c979] text-[#e9c979]" aria-hidden /> {topSalon && `${nf(topSalon.rating, { minimumFractionDigits: 1 })} · ${topSalon.name}`}
        </>
      ),
    },
    {
      id: "calm",
      pos: "-end-6 top-[8%] lg:-end-14",
      content: (
        <>
          <span className="size-2 rounded-full bg-emerald-400" aria-hidden /> {st.chipCalm}
        </>
      ),
    },
    {
      id: "confirmed",
      pos: "-end-20 top-[52%]",
      content: (
        <>
          <CalendarCheck className="size-4 text-emerald-300" aria-hidden /> {f(st.chipConfirmed, { time: "14:00" })}
        </>
      ),
    },
    {
      id: "points",
      pos: "-start-6 bottom-[12%] lg:-start-14",
      content: (
        <>
          <Sparkle className="size-4 fill-[#e9c979] text-[#e9c979]" aria-hidden /> {f(t.common.plusPoints, { n: 30 })} · {t.common.newSalon}
        </>
      ),
    },
  ].filter((chip) => chip.id !== "rating" || topSalon);

  return (
    <div
      ref={ref}
      className="relative isolate flex flex-col overflow-hidden bg-ink px-5 pt-5 pb-28 text-white sm:min-h-[400px] sm:px-10 lg:sticky lg:top-0 lg:h-dvh lg:min-h-0 lg:p-12"
    >
      <div data-orb className="pointer-events-none absolute -start-40 -top-32 -z-10 size-[560px] rounded-full bg-plum-600/40 blur-[120px]" aria-hidden />
      <div data-orb className="pointer-events-none absolute end-[-140px] -bottom-48 -z-10 size-[520px] rounded-full bg-[#d17a9e]/25 blur-[130px]" aria-hidden />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <Link href="/" aria-label={st.backHome} className="inline-flex min-h-11 items-center rounded-xl focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none">
          <Logo inverted />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/15 sm:inline-flex">
            {verified}
          </span>
          <LanguageSwitcher tone="dark" />
        </div>
      </div>

      {/* Téléphone : arche à côté du titre (le formulaire reste dans le premier écran).
          Écrans ≥ sm : `contents` → arche centrée puis titre en bas de la scène. */}
      <div className="relative z-10 mt-5 flex items-center gap-5 sm:contents">
        <div className="relative z-10 w-[104px] shrink-0 sm:mx-auto sm:mt-8 sm:w-[min(56%,300px)] lg:mt-10 lg:w-[min(58%,400px,calc((100dvh-470px)*0.75))]">
          {/* Contour : le div porte la taille (fiable dans Safari), le SVG le remplit */}
          <div className="pointer-events-none absolute -inset-2 z-10 sm:-inset-3.5" aria-hidden>
            <svg data-arch-line className="block size-full text-plum-300/70" viewBox="0 0 100 133" preserveAspectRatio="none">
              <path
                d="M1 132 V50 A49 49 0 0 1 99 50 V132"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset="0"
              />
            </svg>
          </div>

          <div data-arch className="arch relative aspect-[3/4] overflow-hidden bg-plum-900 ring-1 ring-white/15">
            <div className="absolute inset-[-14%] flex gap-1.5 [transform:rotate(-8deg)] sm:gap-3" aria-hidden>
              {COLUMNS.map((col, ci) => (
                <div key={ci} className="min-w-0 flex-1">
                  <div data-col className={cn("flex flex-col", ci === 1 && "-mt-10 sm:-mt-24")}>
                    {[...col, ...col].map((src, i) => (
                      <div key={i} className="pb-1.5 sm:pb-3">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-plum-800 sm:rounded-2xl">
                          <Image src={src} alt="" fill sizes="(min-width: 1024px) 140px, 90px" priority={i < 2} className="object-cover" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-ink/30" aria-hidden />
          </div>

          {chips.map((chip) => (
            <Chip key={chip.id} className={chip.pos}>
              {chip.content}
            </Chip>
          ))}
        </div>

        {/* Titre */}
        <div className="relative z-10 min-w-0 flex-1 text-start sm:mt-auto sm:pt-8 sm:text-center lg:pt-10 lg:text-start">
          <p data-intro className="max-w-lg text-2xl leading-[1.15] font-bold tracking-[-0.03em] sm:mx-auto sm:text-4xl sm:leading-[1.12] lg:mx-0 2xl:text-5xl">
            {st.headlineStart}
            <span data-rotator className="relative block h-[1.25em] overflow-hidden text-plum-200">
              <span className="sr-only">{st.words.join(", ")}</span>
              {st.words.map((w, i) => (
                <span key={w} data-word aria-hidden className={cn("absolute inset-x-0 top-0 whitespace-nowrap", i > 0 && "opacity-0")}>
                  {w}
                </span>
              ))}
            </span>
            {st.headlineEnd}
          </p>
          {/* Téléphone : message déjà porté par le titre et la carte du formulaire */}
          <p data-intro className="mx-auto mt-3 hidden max-w-md text-base text-white/60 sm:block lg:mx-0 lg:mt-4">
            {st.subline}
          </p>
        </div>
      </div>

      {/* Téléphone : badge et puces en rangée lisible (12 px) qui défile */}
      <ul className="no-scrollbar relative z-10 -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 sm:hidden">
        {[{ id: "verified", content: verified }, ...chips].map((chip) => (
          <li
            key={chip.id}
            data-chip-row
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-white/90 ring-1 ring-white/15 [&_svg]:size-3.5"
          >
            {chip.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
