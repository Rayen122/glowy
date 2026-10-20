/** SAL-09 : calcul d'une facture — règles pures, sans base de données (testées dans tests/cashier.test.ts) */

export type InvoiceLine = { label: string; quantity: number; unitPrice: number };

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Sous-total des lignes, remise plafonnée au sous-total, acompte en ligne plafonné au total,
 * reste à encaisser au comptoir. Montants en dinars au millime près.
 */
export function invoiceTotals(lines: InvoiceLine[], discount = 0, deposit = 0) {
  const subtotal = round(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0));
  const appliedDiscount = round(Math.min(Math.max(discount, 0), subtotal));
  const total = round(subtotal - appliedDiscount);
  const appliedDeposit = round(Math.min(Math.max(deposit, 0), total));
  return { subtotal, discount: appliedDiscount, total, deposit: appliedDeposit, due: round(total - appliedDeposit) };
}

/** Préfixe lisible du salon : trois lettres du slug (« salon-yasmine » → « SAL »), GLW à défaut */
export function invoicePrefix(slug: string) {
  const words = slug.split("-").filter((w) => !["salon", "institut", "spa", "maison", "beauty", "chez"].includes(w));
  const letters = (words.join("") || slug).replace(/[^a-z]/gi, "");
  return (letters.slice(0, 3) || "GLW").toUpperCase();
}

/** Numéro de facture séquentiel par salon et par année : YAS-2026-00042 */
export const invoiceNumber = (prefix: string, year: number, seq: number) => `${prefix}-${year}-${String(seq).padStart(5, "0")}`;
