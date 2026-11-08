import type { NextAuthConfig } from "next-auth";

/**
 * Configuration Auth.js commune (sans base de données ni bcrypt) : utilisée par src/proxy.ts
 * pour les vérifications rapides, et complétée dans src/auth.ts avec les fournisseurs de connexion.
 * Session JWT signée (cookie httpOnly, SameSite=Lax) qui porte l'id, le rôle et le prénom.
 */
export const authConfig = {
  pages: { signIn: "/connexion" },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.firstName = user.firstName;
        // Heure de connexion : une session ouverte avant un changement de mot de passe est refusée
        token.authAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.firstName = token.firstName;
      session.user.authAt = token.authAt;
      return session;
    },
  },
} satisfies NextAuthConfig;

/** Page d'accueil de chaque rôle après connexion */
export const homeForRole = (role: string) => (role === "ADMIN" ? "/admin" : role === "MANAGER" || role === "EMPLOYEE" ? "/dashboard" : "/compte");
