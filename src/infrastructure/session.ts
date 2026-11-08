import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeForRole } from "@/auth.config";
import type { Actor, Role } from "@/core/domain/actor";
import { AppError, forbidden, unauthorized } from "@/core/domain/errors";
import { sessionUser } from "@/modules/identity";

/**
 * Contrôle d'accès définitif (AUTH-04), dans chaque page et chaque route API.
 * Le compte est relu en base : un utilisateur bloqué perd l'accès immédiatement, même avec une session valide.
 */
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser(...roles: Role[]): Promise<Actor & { firstName: string; lastName: string; email: string }> {
  const session = await currentUser();
  if (!session) throw unauthorized();
  const user = await sessionUser(session.id, session.authAt);
  if (!user) throw unauthorized("Session expirée. Reconnectez-vous.");
  if (roles.length && !roles.includes(user.role)) throw forbidden();
  return { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

/** Utilisateur connecté et actif, ou null (routes ouvertes aux visiteurs) */
export async function currentActor(): Promise<Actor | null> {
  const session = await currentUser();
  const user = session ? await sessionUser(session.id, session.authAt) : null;
  return user ? { id: user.id, role: user.role } : null;
}

/** Variante pour les pages : redirige au lieu de lever une erreur */
export async function requirePageUser(...roles: Role[]) {
  try {
    return await requireUser(...roles);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/connexion");
    if (error instanceof AppError && error.status === 403) {
      const session = await currentUser();
      redirect(session ? homeForRole(session.role) : "/connexion");
    }
    throw error;
  }
}
