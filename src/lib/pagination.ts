/**
 * Numéros de page à afficher : toujours la première et la dernière page, la page courante et ses voisines,
 * « gap » pour les pages sautées. `slots` = nombre maximal d'éléments (7 sur grand écran, 5 sur téléphone).
 */
export function pageItems(page: number, pages: number, slots = 7): (number | "gap")[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pages <= slots) return range(1, pages);
  if (page <= slots - 3) return [...range(1, slots - 2), "gap", pages];
  if (page >= pages - (slots - 4)) return [1, "gap", ...range(pages - slots + 3, pages)];
  const half = (slots - 5) / 2;
  return [1, "gap", ...range(page - half, page + half), "gap", pages];
}

/** Nombre de pages et page courante ramenée dans les bornes (une page inexistante affiche la dernière) */
export function paginate(total: number, pageSize: number, requested: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(requested) || 1), pages);
  return { page, pages, start: (page - 1) * pageSize, end: page * pageSize };
}
