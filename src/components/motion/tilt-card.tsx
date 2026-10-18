"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, useGSAP } from "@/lib/gsap";

/** Inclinaison 3D qui suit le pointeur (souris uniquement, animations autorisées). */
export function TiltCard({ children, className, max = 12 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add(`${MOTION_OK} and (hover: hover)`, () => {
        gsap.set(el, { transformPerspective: 900 });
        const rotX = gsap.quickTo(el, "rotationX", { duration: 0.7, ease: "power3.out" });
        const rotY = gsap.quickTo(el, "rotationY", { duration: 0.7, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          rotY(((e.clientX - r.left) / r.width - 0.5) * max);
          rotX(-((e.clientY - r.top) / r.height - 0.5) * max);
        };
        const leave = () => {
          rotX(0);
          rotY(0);
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerleave", leave);
        };
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className} style={{ transformStyle: "preserve-3d" }}>
      {children}
    </div>
  );
}
