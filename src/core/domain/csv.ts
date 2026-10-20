/**
 * CSV lisible par Excel (SAL-11, ADM-08) : UTF-8 avec BOM, séparateur « ; » (Excel en français),
 * formules neutralisées (=, +, -, @ en début de cellule) contre l'injection CSV.
 */
export function cell(value: string | number | null | undefined) {
  // Nombre : virgule décimale (Excel en français) ; un nombre négatif reste un nombre
  if (typeof value === "number") return String(value).replace(".", ",");
  const text = value ?? "";
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  return `﻿${[header.map(cell).join(";"), ...rows.map((r) => r.map(cell).join(";"))].join("\r\n")}\r\n`;
}

export const csvResponse = (body: string, filename: string) =>
  new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" } });
