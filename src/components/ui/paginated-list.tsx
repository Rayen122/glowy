"use client";

import { Children, useRef, useState, type ReactNode } from "react";
import { paginate } from "@/lib/pagination";
import { Pagination } from "./pagination";

/**
 * Pagination dans le navigateur d'une liste déjà rendue (éléments <li> passés en enfants, rendus côté
 * serveur ou client). Au changement de page, la liste revient en haut de l'écran.
 */
export function PaginatedList({ pageSize, className, children }: { pageSize: number; className?: string; children: ReactNode }) {
  const items = Children.toArray(children);
  const [requested, setRequested] = useState(1);
  const { page, pages, start, end } = paginate(items.length, pageSize, requested);
  const top = useRef<HTMLDivElement>(null);

  const go = (next: number) => {
    setRequested(next);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={top} className="scroll-mt-28 space-y-5">
      <ul className={className}>{items.slice(start, end)}</ul>
      <Pagination page={page} pages={pages} onChange={go} />
    </div>
  );
}
