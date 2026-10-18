"use client";

/**
 * Point d'entrée unique GSAP : enregistre les plugins une seule fois.
 * Tous les composants animés importent gsap depuis ce module.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
  gsap.defaults({ ease: "power3.out", duration: 0.8 });
}

/** Préférence système « réduire les animations » */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, ScrollTrigger, SplitText, useGSAP };
