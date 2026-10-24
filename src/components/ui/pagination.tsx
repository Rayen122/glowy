"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type Target = { href: (page: number) => string; onChange?: never } | { onChange: (page: number) => void; href?: never };

const CELL = "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors sm:size-9";

/**
 * Pagination numérotée. Liens (`href`, pages rendues par le serveur, l'adresse garde la page)
 * ou boutons (`onChange`, liste paginée dans le navigateur). Cibles de 44 px sur téléphone,
 * 5 éléments au plus sur téléphone et 7 sur grand écran pour ne jamais déborder.
 */
export function Pagination({ page, pages, className, ...target }: { page: number; pages: number; className?: string } & Target) {
  const { t, f, nf } = useI18n();
  const p = t.common.pagination;
  if (pages <= 1) return null;

  const cell = (to: number, content: ReactNode, label: string, extra?: string) => {
    const cls = cn(CELL, "bg-card ring-1 ring-border hover:bg-muted", extra);
    return target.href ? (
      <Link href={target.href(to)} aria-label={label} className={cls}>
        {content}
      </Link>
    ) : (
      <button type="button" onClick={() => target.onChange(to)} aria-label={label} className={cls}>
        {content}
      </button>
    );
  };

  const list = (slots: number, visibility: string) => (
    <ol className={cn("items-center gap-1", visibility)}>
      {pageItems(page, pages, slots).map((item, i) =>
        item === "gap" ? (
          <li key={`gap-${i}`} aria-hidden className="w-5 text-center text-muted-foreground">
            …
          </li>
        ) : (
          <li key={item}>
            {item === page ? (
              <span aria-current="page" aria-label={f(p.page, { page: nf(page), pages: nf(pages) })} className={cn(CELL, "bg-primary text-primary-foreground")}>
                {nf(item)}
              </span>
            ) : (
              cell(item, nf(item), f(p.goTo, { n: nf(item) }))
            )}
          </li>
        )
      )}
    </ol>
  );

  const arrow = (to: number, label: string, icon: ReactNode) =>
    to < 1 || to > pages ? (
      <span aria-hidden className={cn(CELL, "text-muted-foreground/40")}>
        {icon}
      </span>
    ) : (
      cell(to, icon, label)
    );

  return (
    <nav aria-label={p.label} className={cn("flex items-center justify-center gap-1", className)}>
      {arrow(page - 1, p.previous, <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />)}
      {list(5, "flex sm:hidden")}
      {list(7, "hidden sm:flex")}
      {arrow(page + 1, p.next, <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />)}
    </nav>
  );
}
