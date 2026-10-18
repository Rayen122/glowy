"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useI18n } from "@/i18n/client";
import { gsap, MOTION_OK, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";

/*
 * Système d'animation déclaratif. Les pages (composants serveur) posent des attributs :
 *   data-animate="fade-up"  élément qui monte en fondu à l'entrée dans l'écran
 *   data-animate="stagger"  conteneur dont les enfants apparaissent en cascade (data-stagger="0.1")
 *   data-animate="split"    titre révélé mot par mot (SplitText, lignes masquées)
 *   data-animate="count"    nombre compté depuis 0 (élément texte « feuille » uniquement)
 *   data-animate="grow-x"   barre qui se remplit (scaleX) ; "grow-y" : enfants qui montent (scaleY)
 *   data-animate="pop"      apparition avec léger rebond ; "clip" : image dévoilée de bas en haut
 *   data-speed="-8"         parallaxe (yPercent parcouru pendant le scroll)
 * Règle : n'utiliser ces attributs que sur du contenu présent au chargement de la page
 * (pas dans un onglet ou un bloc monté plus tard côté client).
 * Les compteurs lisent et réécrivent les nombres au format de la langue active (12 860 · 12,860 · 12.860).
 */

let firstLoad = true;

const NUM = /\d(?:[\d\s\u00a0\u202f,.]*\d)?/;

/** Séparateurs de milliers et décimal de la langue (fr : espace fine / virgule, en : virgule / point, ar-TN : point / virgule) */
function separators(intl: string) {
  const parts = new Intl.NumberFormat(intl).formatToParts(1234567.8);
  return {
    group: parts.find((p) => p.type === "group")?.value ?? "",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

function initAll(root: HTMLElement, intl: string) {
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel, root);
  const mark = (el: Element) => el.setAttribute("data-animated", "");
  const restores: (() => void)[] = [];

  // Fondu montant, regroupé par lots pour des cascades naturelles
  const fades = $('[data-animate="fade-up"]');
  fades.forEach(mark);
  if (fades.length) {
    gsap.set(fades, { autoAlpha: 0, y: 36 });
    ScrollTrigger.batch(fades, {
      start: "top 90%",
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1, overwrite: true }),
    });
  }

  // Cascades d'enfants
  $('[data-animate="stagger"]').forEach((container) => {
    mark(container);
    const items = Array.from(container.children) as HTMLElement[];
    if (!items.length) return;
    gsap.set(items, { autoAlpha: 0, y: 32 });
    ScrollTrigger.create({
      trigger: container,
      start: "top 88%",
      once: true,
      onEnter: () =>
        gsap.to(items, {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          stagger: Number(container.dataset.stagger ?? 0.08),
          overwrite: true,
        }),
    });
  });

  // Titres mot par mot
  $('[data-animate="split"]').forEach((el) => {
    mark(el);
    SplitText.create(el, {
      type: "lines,words",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.words, {
          yPercent: 115,
          duration: 1,
          ease: "power4.out",
          stagger: 0.035,
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        }),
    });
  });

  // Compteurs
  const { group, decimal } = separators(intl);
  $('[data-animate="count"]').forEach((el) => {
    mark(el);
    const original = el.textContent ?? "";
    const match = original.match(NUM);
    if (!match) return;
    const raw = match[0];
    const decimals = raw.includes(decimal) ? (raw.split(decimal).pop() ?? "").length : 0;
    const target = parseFloat(raw.replace(/[\s\u00a0\u202f]/g, "").split(group).join("").replace(decimal, "."));
    if (!Number.isFinite(target)) return;
    const format = new Intl.NumberFormat(intl, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const state = { v: 0 };
    const render = () => {
      el.textContent = original.replace(raw, format.format(state.v));
    };
    render();
    gsap.to(state, {
      v: target,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: render,
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    });
    restores.push(() => {
      el.textContent = original;
    });
  });

  // Barres
  $('[data-animate="grow-x"]').forEach((el) => {
    mark(el);
    const rtl = getComputedStyle(el).direction === "rtl";
    gsap.from(el, {
      scaleX: 0,
      transformOrigin: rtl ? "100% 50%" : "0% 50%",
      duration: 1.2,
      scrollTrigger: { trigger: el, start: "top 94%", once: true },
    });
  });
  $('[data-animate="grow-y"]').forEach((el) => {
    mark(el);
    gsap.from(el.children, {
      scaleY: 0,
      transformOrigin: "50% 100%",
      duration: 0.9,
      stagger: 0.04,
      scrollTrigger: { trigger: el, start: "top 94%", once: true },
    });
  });

  // Apparition avec rebond
  $('[data-animate="pop"]').forEach((el) => {
    mark(el);
    gsap.set(el, { autoAlpha: 0, y: 24, scale: 0.94 });
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () => gsap.to(el, { autoAlpha: 1, y: 0, scale: 1, duration: 1, ease: "back.out(1.4)" }),
    });
  });

  // Images dévoilées
  $('[data-animate="clip"]').forEach((el) => {
    mark(el);
    const img = el.querySelector("img");
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    tl.fromTo(
      el,
      { clipPath: "inset(100% 0% 0% 0%)", autoAlpha: 1 },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "expo.out" }
    );
    if (img) tl.from(img, { scale: 1.25, duration: 1.6, ease: "expo.out" }, 0);
  });

  // Parallaxe
  $("[data-speed]").forEach((el) => {
    const speed = parseFloat(el.dataset.speed ?? "0");
    if (!speed) return;
    gsap.to(el, {
      yPercent: speed,
      ease: "none",
      scrollTrigger: { trigger: el, start: "clamp(top bottom)", end: "bottom top", scrub: 0.6 },
    });
  });

  return () => restores.forEach((fn) => fn());
}

export function MotionRoot({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  // Changement de langue : on remonte tout le sous-arbre, SplitText et les compteurs ayant modifié le DOM
  return <MotionScope key={locale}>{children}</MotionScope>;
}

function MotionScope({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { intl } = useI18n();

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const isFirst = firstLoad;
      if (firstLoad) {
        window.setTimeout(() => {
          firstLoad = false;
        }, 0);
      }

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        // Transition de page douce (pas au tout premier affichage : le HTML serveur est déjà visible)
        if (!isFirst) gsap.from(el, { autoAlpha: 0, duration: 0.45, ease: "power1.out", clearProps: "opacity,visibility" });
        return initAll(el, intl);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [pathname], revertOnUpdate: true }
  );

  return <div ref={root}>{children}</div>;
}
