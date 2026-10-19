import type { Role } from "@/core/domain/actor";
import type { Clock } from "@/core/domain/clock";
import { badRequest, conflict, unauthorized } from "@/core/domain/errors";
import type { EventPublisher } from "@/core/domain/events";
import { slugify } from "@/core/domain/text";
import { afterFailedLogin, coordsFor, isLocked, referralCandidate, temporaryPassword, TOKEN_TTL_MINUTES } from "../domain/account";
import type { AccountRepository, Mailer, PasswordHasher, TokenFactory, UserAccount } from "./ports";
import type { RegisterInput } from "./schemas";

export type IdentityDeps = { accounts: AccountRepository; hasher: PasswordHasher; events: EventPublisher; clock: Clock; tokens: TokenFactory; mailer: Mailer };

export type AuthResult = { ok: true; user: UserAccount } | { ok: false; reason: "invalid" | "locked" | "blocked" };

/** Comptes (P1) : inscription (AUTH-01, AUTH-02) et vérification des identifiants (AUTH-03) */
export function makeIdentity({ accounts, hasher, events, clock, tokens, mailer }: IdentityDeps) {
  async function uniqueReferralCode(base: string) {
    for (;;) {
      const code = referralCandidate(base);
      if (!(await accounts.referralCodeTaken(code))) return code;
    }
  }

  async function uniqueSalonSlug(base: string) {
    const root = slugify(base) || "salon";
    for (let i = 0; ; i++) {
      const slug = i ? `${root}-${i + 1}` : root;
      if (!(await accounts.salonSlugTaken(slug))) return slug;
    }
  }

  /**
   * Inscription. Cliente : compte actif immédiatement. Salon : compte gérant + salon en attente
   * de validation par le Super Admin (AUTH-02) ; il n'apparaît pas dans la recherche avant.
   */
  async function register(input: RegisterInput) {
    if (await accounts.emailTaken(input.email)) throw conflict("EMAIL_TAKEN", "Un compte existe déjà avec cette adresse e-mail.");
    const passwordHash = await hasher.hash(input.password);

    if (input.type === "client") {
      const referredById = input.referralCode ? await accounts.userIdByReferralCode(input.referralCode.toUpperCase()) : null;
      const user = await accounts.createClient({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        locale: input.locale,
        referralCode: await uniqueReferralCode(input.firstName),
        referredById,
      });
      await events.publish("user.registered", { userId: user.id });
      return { user, salon: null };
    }

    const [lat, lng] = coordsFor(input.city);
    const { user, salon } = await accounts.createSalonOwner({
      owner: { email: input.email, passwordHash, name: input.salonName, phone: input.phone, locale: input.locale, referralCode: await uniqueReferralCode(input.salonName) },
      salon: {
        slug: await uniqueSalonSlug(`${input.salonName} ${input.city}`),
        name: input.salonName,
        category: input.category,
        city: input.city,
        address: input.address,
        phone: input.phone,
        // Le plan payant n'est activé qu'après acceptation du paiement par le Super Admin (module abonnements)
        plan: "gratuit",
        lat,
        lng,
        documentUrl: input.documentName ?? null,
      },
    });
    await events.publish("salon.registered", { salonId: salon.id, ownerId: user.id, plan: input.plan });
    return { user, salon };
  }

  /** Connexion e-mail + mot de passe, avec blocage temporaire après 5 échecs */
  async function authenticate(email: string, password: string): Promise<AuthResult> {
    const user = await accounts.findByEmail(email);
    if (!user?.passwordHash) {
      await hasher.burn(password);
      return { ok: false, reason: "invalid" };
    }
    if (user.status === "BLOCKED") return { ok: false, reason: "blocked" };
    const now = clock.now();
    if (isLocked(user, now)) return { ok: false, reason: "locked" };

    if (!(await hasher.verify(password, user.passwordHash))) {
      const next = afterFailedLogin(user, now);
      await accounts.saveLoginState(user.id, next);
      return { ok: false, reason: next.locked ? "locked" : "invalid" };
    }
    if (user.failedLogins || user.lockedUntil) await accounts.saveLoginState(user.id, { failedLogins: 0, lockedUntil: null });
    return { ok: true, user };
  }

  /** Connexion démo (un clic par rôle) : compte créé par le seed, jamais un compte bloqué */
  async function demoAccount(role: Role, email: string) {
    const user = await accounts.findByRole(role, email);
    return user && user.status === "ACTIVE" ? user : null;
  }

  /** Utilisateur de la session, relu en base à chaque requête : un compte bloqué perd l'accès aussitôt (AUTH-04) */
  async function sessionUser(id: string) {
    const user = await accounts.findById(id);
    return user && user.status === "ACTIVE" ? user : null;
  }

  /** AUTH-07 : compte de connexion d'un employé, avec un mot de passe temporaire à lui transmettre */
  async function createStaffAccount(input: { email: string; firstName: string; lastName?: string }) {
    const email = input.email.trim().toLowerCase();
    if (await accounts.emailTaken(email)) throw conflict("EMAIL_TAKEN", "Un compte existe déjà avec cette adresse e-mail.");
    const password = temporaryPassword();
    const user = await accounts.createStaffUser({
      email,
      passwordHash: await hasher.hash(password),
      firstName: input.firstName,
      lastName: input.lastName ?? "",
      referralCode: await uniqueReferralCode(input.firstName),
    });
    return { id: user.id, email, temporaryPassword: password };
  }

  async function issueLink(user: { id: string }, purpose: "reset" | "verify") {
    const { token, hash } = tokens.create();
    await accounts.saveToken(user.id, purpose, hash, new Date(clock.now().getTime() + TOKEN_TTL_MINUTES[purpose] * 60_000));
    return token;
  }

  /**
   * AUTH-05 : envoie un lien de réinitialisation valable 1 h. Même réponse que le compte existe ou non
   * (pas d'énumération des adresses) ; rien n'est envoyé à un compte bloqué.
   */
  async function requestPasswordReset(email: string, origin: string) {
    const user = await accounts.findByEmail(email.trim().toLowerCase());
    if (!user || user.status !== "ACTIVE") return { sent: true };
    const token = await issueLink(user, "reset");
    await mailer.send(
      user.email,
      "Réinitialiser votre mot de passe Glowy",
      `Bonjour ${user.firstName},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${origin}/reinitialiser?token=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`
    );
    return { sent: true };
  }

  /** AUTH-05 : nouveau mot de passe ; le lien ne sert qu'une fois et débloque le compte */
  async function resetPassword(token: string, password: string) {
    const userId = await accounts.consumeToken("reset", tokens.hash(token), clock.now());
    if (!userId) throw badRequest("INVALID_TOKEN", "Ce lien n'est plus valable. Demandez-en un nouveau.");
    await accounts.setPasswordHash(userId, await hasher.hash(password));
    // Le lien reçu par e-mail prouve aussi que l'adresse est la bonne
    await accounts.markEmailVerified(userId, clock.now());
    return { reset: true };
  }

  /** AUTH-06 : lien de vérification (48 h), envoyé à l'inscription et sur demande */
  async function sendEmailVerification(userId: string, origin: string) {
    const user = await accounts.findById(userId);
    if (!user || (await accounts.isEmailVerified(userId))) return { sent: false };
    const token = await issueLink(user, "verify");
    await mailer.send(
      user.email,
      "Confirmez votre adresse e-mail",
      `Bonjour ${user.firstName},\n\nConfirmez votre adresse e-mail en ouvrant ce lien (valable 48 heures) :\n${origin}/verifier-email?token=${token}`
    );
    return { sent: true };
  }

  async function verifyEmail(token: string) {
    const userId = await accounts.consumeToken("verify", tokens.hash(token), clock.now());
    if (!userId) throw badRequest("INVALID_TOKEN", "Ce lien n'est plus valable. Demandez-en un nouveau depuis votre compte.");
    await accounts.markEmailVerified(userId, clock.now());
    return { verified: true };
  }

  /** Changement de mot de passe d'un utilisateur connecté : l'ancien est exigé */
  async function changePassword(userId: string, current: string, next: string) {
    const user = await accounts.findById(userId);
    if (!user?.passwordHash || !(await hasher.verify(current, user.passwordHash))) throw unauthorized("Mot de passe actuel incorrect.");
    await accounts.setPasswordHash(userId, await hasher.hash(next));
    return { changed: true };
  }

  return { register, authenticate, demoAccount, sessionUser, createStaffAccount, requestPasswordReset, resetPassword, sendEmailVerification, verifyEmail, changePassword };
}
