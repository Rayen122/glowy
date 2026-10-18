/** « Salon Élégance Tunis » → « salon-elegance-tunis » */
export const slugify = (text: string, max = 60) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);

/** Nom affiché publiquement (avis, agenda) : prénom + initiale du nom */
export const shortName = (firstName: string, lastName: string) => `${firstName} ${lastName.charAt(0)}${lastName ? "." : ""}`.trim();

/** Suffixe aléatoire en majuscules (codes de parrainage, d'échange) */
export const randomCode = (length: number) =>
  Array.from({ length }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
