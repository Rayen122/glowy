"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";

/**
 * Carte du formulaire d'authentification : entrée animée, titre lettre par lettre,
 * puis cascade des éléments marqués data-auth-item.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const card = ref.current;
      if (!card) return;
      card.setAttribute("data-animated", "");
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const tl = gsap.timeline({ delay: 0.35, defaults: { ease: "power3.out" } });
        tl.fromTo(card, { autoAlpha: 0, y: 48, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.1 });

        const title = card.querySelector("h1");
        if (title) {
          // L'arabe est une écriture liée : on anime par mots, jamais par lettres
          const byWord = document.documentElement.lang === "ar";
          const split = SplitText.create(title, { type: byWord ? "words" : "words,chars", mask: "words" });
          tl.from(byWord ? split.words : split.chars, { yPercent: 115, duration: 0.8, stagger: byWord ? 0.08 : 0.022, ease: "power4.out" }, 0.3);
        }

        const items = gsap.utils.toArray<HTMLElement>("[data-auth-item]", card);
        if (items.length) tl.from(items, { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.06 }, 0.45);
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      data-auth-card
      className="relative mx-auto w-full max-w-[468px] rounded-[1.75rem] bg-ivory p-6 text-ink shadow-[0_40px_120px_-30px_rgb(0_0_0/0.7)] ring-1 ring-white/10 sm:rounded-[2rem] sm:p-10"
    >
      {children}
    </div>
  );
}
