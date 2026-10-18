import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Version claire pour fonds prune / photo */
  inverted?: boolean;
  /** Masque le texte (icône seule) */
  markOnly?: boolean;
};

/** Icône Glowy (carré arrondi violet, papillon et signature) — fichier source : public/brand/glowy-logo.svg */
export function LogoMark({ className }: { inverted?: boolean; className?: string }) {
  return <Image src="/brand/glowy-mark.png" alt="" width={256} height={256} className={cn("size-8 shrink-0 rounded-[10px]", className)} aria-hidden />;
}

export function Logo({ className, inverted, markOnly }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      {!markOnly && <span className={cn("text-[1.15rem] leading-none font-bold tracking-[-0.03em] sm:text-[1.3rem]", inverted ? "text-white" : "text-ink")}>Glowy</span>}
    </span>
  );
}
