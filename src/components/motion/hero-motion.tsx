"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, SplitText, useGSAP } from "@/lib/gsap";

/**
 * Chorégraphie d'arrivée du hero (accueil). Les éléments portent data-hero="…" :
 * badge · title · lead · stats · arch · side · card · search · chips.
 */
export function HeroMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, () => {
        const $ = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-hero="${name}"]`, root);

        const title = $("title")[0];
        if (title) {
          SplitText.create(title, {
            type: "lines,words",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => {
              gsap.set(title, { autoAlpha: 1 });
              return gsap.from(self.words, { yPercent: 115, duration: 1.15, ease: "power4.out", stagger: 0.06, delay: 0.2 });
            },
          });
        }

        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo($("badge"), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.05)
          .fromTo($("lead"), { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.9 }, 0.6)
          .fromTo($("stats"), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.75)
          .fromTo(
            $("arch"),
            { clipPath: "inset(100% 0% 0% 0%)", autoAlpha: 1 },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.out" },
            0.15
          )
          .from($("arch").flatMap((a) => Array.from(a.querySelectorAll("img"))), { scale: 1.3, duration: 1.9, ease: "expo.out" }, 0.15)
          .fromTo($("side"), { autoAlpha: 0, x: document.documentElement.dir === "rtl" ? 40 : -40 }, { autoAlpha: 1, x: 0, duration: 1.1 }, 0.5)
          .fromTo(
            $("card"),
            { autoAlpha: 0, y: 30, scale: 0.9 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.18, ease: "back.out(1.7)" },
            0.95
          )
          .fromTo($("search"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.55)
          .fromTo($("chips"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.9);

        // Cartes qui flottent doucement une fois arrivées
        $("card").forEach((card, i) => {
          gsap.to(card, {
            y: i % 2 ? 9 : -9,
            duration: 2.6 + i * 0.5,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
            delay: 2 + i * 0.25,
          });
        });
      });

      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
