import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "start",
  className,
  invert,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: { href: string; label: string };
  align?: "start" | "center";
  className?: string;
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className
      )}
    >
      <div className={cn("max-w-2xl space-y-3", align === "center" && "mx-auto")}>
        {eyebrow && <p data-animate="fade-up" className={cn("eyebrow", invert && "text-plum-200")}>{eyebrow}</p>}
        <h2 data-animate="split" className={cn("display text-3xl sm:text-4xl lg:text-[2.75rem]", invert ? "text-white" : "text-ink")}>
          {title}
        </h2>
        {description && (
          <p data-animate="fade-up" className={cn("text-base leading-relaxed", invert ? "text-white/75" : "text-muted-foreground")}>
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          data-animate="fade-up"
          className={cn(
            "group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline",
            invert ? "text-white" : "text-plum-700"
          )}
        >
          {action.label}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
        </Link>
      )}
    </div>
  );
}
