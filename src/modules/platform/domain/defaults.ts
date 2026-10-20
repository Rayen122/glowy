import { CATEGORIES, LOCALES, type Category, type Locale, type PlanId } from "@/core/domain/enums";

/** ADM-05 / ADM-06 : réglages par défaut de la plateforme, utilisés tant que le Super Admin n'a rien modifié */

export type PlatformSettingsView = {
  cities: { name: string; active: boolean }[];
  categories: { id: Category; active: boolean }[];
  serviceGroups: string[];
  locales: Locale[];
  commissions: Record<PlanId, number>;
};

export const DEFAULT_SETTINGS: PlatformSettingsView = {
  cities: ["Tunis", "La Marsa", "Sousse", "Sfax", "Nabeul", "Hammamet", "Monastir", "Bizerte"].map((name) => ({ name, active: true })),
  categories: CATEGORIES.map((id) => ({ id, active: true })),
  serviceGroups: ["Coupe", "Couleur", "Coiffage", "Soins", "Barbe", "Ongles", "Épilation", "Massage", "Maquillage", "Visage", "Forfaits"],
  locales: [...LOCALES],
  commissions: { gratuit: 10, pro: 5, premium: 3 },
};

/** Commission Glowy sur un acompte en ligne (en dinars, au millime) */
export const commissionOn = (deposit: number, ratePercent: number) => Math.round(deposit * ratePercent * 10) / 1000;
