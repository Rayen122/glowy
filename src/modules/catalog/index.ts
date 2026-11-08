/** Module Catalogue (P3) — API publique : recherche, fiche salon, favoris */
export { favoriteSalons, getSalonDetail, recommendedSalons, searchSalons, withAiRanking, type SalonDetail, type SalonSearch } from "./infrastructure/queries";
export { favoriteEmployees, setFavorite, setFavoriteEmployee, type FavoriteEmployee } from "./infrastructure/favorites";
export { platformShowcase, type Showcase } from "./infrastructure/showcase";
