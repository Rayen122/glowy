import type { Dictionary } from "@/i18n/dictionaries/fr";

/**
 * Modules du dashboard salon et du Super Admin, reliés aux exigences du cahier des charges.
 * Sert aux pages « à construire » : chaque membre voit ses exigences et sa priorité.
 * Titres, descriptions et libellés des exigences sont traduits dans le dictionnaire (t.modules).
 */

export type Priority = "must" | "should" | "bonus";
export type Requirement = { ref: keyof Dictionary["modules"]["requirements"]; priority: Priority };
export type ModuleDef<Slug extends string = string> = { slug: Slug; owners: number[]; requirements: Requirement[] };

export const SALON_MODULES: ModuleDef<keyof Dictionary["modules"]["salon"]>[] = [
  { slug: "stocks", owners: [2], requirements: [{ ref: "SAL-12", priority: "bonus" }] },
];

export const ADMIN_MODULES: ModuleDef<keyof Dictionary["modules"]["admin"]>[] = [
  { slug: "abonnements", owners: [5], requirements: [{ ref: "ADM-05", priority: "should" }] },
  { slug: "rapports", owners: [1], requirements: [{ ref: "ADM-08", priority: "should" }] },
  {
    slug: "parametres",
    owners: [1],
    requirements: [
      { ref: "ADM-06", priority: "should" },
      { ref: "ADM-10", priority: "bonus" },
    ],
  },
];
