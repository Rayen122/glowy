import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { ROLES } from "@/core/domain/actor";
import { authenticate, credentialsInput, demoAccount, oauthSignIn, type UserAccount } from "@/modules/identity";
import { authConfig } from "./auth.config";

/**
 * Authentification (P1, AUTH-03 / AUTH-04) : e-mail + mot de passe haché (bcrypt), 4 rôles,
 * blocage après 5 échecs pendant 15 minutes (cahier §10) — règles dans src/modules/identity.
 * Fournisseur « demo » (connexion en un clic par rôle) : actif seulement si DEMO_LOGIN=true.
 */
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class AccountLocked extends CredentialsSignin {
  code = "account_locked";
}
class AccountBlocked extends CredentialsSignin {
  code = "account_blocked";
}

const toSessionUser = (user: UserAccount) => ({
  id: user.id,
  email: user.email,
  name: `${user.firstName} ${user.lastName}`.trim(),
  image: user.avatarUrl,
  role: user.role,
  firstName: user.firstName,
});

/** Comptes ouverts par la connexion démo (créés par `npm run db:seed`) */
const DEMO_ACCOUNTS = {
  CLIENT: "sarra@beautyhub.tn",
  MANAGER: "yasmine@beautyhub.tn",
  EMPLOYEE: "nour@beautyhub.tn",
  ADMIN: "admin@beautyhub.tn",
} as const;

export const demoLoginEnabled = process.env.DEMO_LOGIN === "true";

/** AUTH-08 (bonus) : connexion Google, active seulement si l'application OAuth est configurée */
export const googleLoginEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

type GoogleProfile = { email?: string; email_verified?: boolean; given_name?: string; family_name?: string; locale?: string };
const googleAccount = (profile: GoogleProfile) =>
  oauthSignIn({
    email: profile.email ?? "",
    emailVerified: profile.email_verified === true,
    firstName: profile.given_name ?? "",
    lastName: profile.family_name ?? "",
    locale: profile.locale?.startsWith("ar") ? "ar" : profile.locale?.startsWith("en") ? "en" : "fr",
  });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /** Google : refus si l'adresse n'est pas vérifiée ou si le compte est bloqué */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return Boolean(profile && (await googleAccount(profile as GoogleProfile)));
    },
    async jwt(params) {
      const { token, account, profile } = params;
      if (account?.provider === "google" && profile) {
        const user = await googleAccount(profile as GoogleProfile);
        if (user) Object.assign(token, { id: user.id, role: user.role, firstName: user.firstName, name: `${user.firstName} ${user.lastName}`.trim() });
        return token;
      }
      return authConfig.callbacks.jwt(params);
    },
  },
  providers: [
    ...(googleLoginEnabled ? [Google] : []),
    Credentials({
      id: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsInput.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const result = await authenticate(parsed.data.email, parsed.data.password);
        if (result.ok) return toSessionUser(result.user);
        if (result.reason === "locked") throw new AccountLocked();
        if (result.reason === "blocked") throw new AccountBlocked();
        throw new InvalidCredentials();
      },
    }),
    ...(demoLoginEnabled
      ? [
          Credentials({
            id: "demo",
            credentials: { role: {} },
            async authorize(raw) {
              const role = z.enum(ROLES).safeParse((raw as { role?: unknown }).role);
              if (!role.success) throw new InvalidCredentials();
              const user = await demoAccount(role.data, DEMO_ACCOUNTS[role.data]);
              if (!user) throw new InvalidCredentials();
              return toSessionUser(user);
            },
          }),
        ]
      : []),
  ],
});
