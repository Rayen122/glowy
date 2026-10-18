/** Rôles de la plateforme (cahier §2) et utilisateur authentifié tel que vu par les cas d'usage */
export const ROLES = ["CLIENT", "EMPLOYEE", "MANAGER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export type Actor = { id: string; role: Role };
