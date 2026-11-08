import type { Role } from "@/core/domain/actor";
import type { Locale, LoginState, UserStatus } from "../domain/account";
import type { RegisterInput } from "./schemas";

/** Ports du module : ce dont les cas d'usage ont besoin, implémenté par ../infrastructure */

export type UserAccount = LoginState & {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  passwordHash: string | null;
  passwordChangedAt: Date | null;
};

export type NewClient = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  locale: Locale;
  referralCode: string;
  referredById: string | null;
};

type SalonForm = Extract<RegisterInput, { type: "salon" }>;

export type NewSalonOwner = {
  owner: { email: string; passwordHash: string; name: string; phone: string; locale: Locale; referralCode: string };
  salon: Pick<SalonForm, "category" | "city" | "address" | "phone" | "plan"> & { slug: string; name: string; lat: number; lng: number; documentUrl: string | null };
};

export interface AccountRepository {
  findByEmail(email: string): Promise<UserAccount | null>;
  findByRole(role: Role, email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
  /** Compte du personnel créé par un gérant (AUTH-07) */
  createStaffUser(data: { email: string; passwordHash: string; firstName: string; lastName: string; referralCode: string }): Promise<{ id: string }>;
  /** Nouveau mot de passe : débloque le compte et date le changement (les autres sessions sont fermées) */
  setPasswordHash(userId: string, passwordHash: string, at: Date): Promise<void>;
  /** Lien à usage unique (empreinte seulement) */
  saveToken(userId: string, purpose: "reset" | "verify", tokenHash: string, expiresAt: Date): Promise<void>;
  /** Date du dernier lien émis pour ce compte et cet usage, ou null */
  lastTokenAt(userId: string, purpose: "reset" | "verify"): Promise<Date | null>;
  /** Consomme un lien valide (non utilisé, non expiré) et renvoie l'utilisateur, ou null */
  consumeToken(purpose: "reset" | "verify", tokenHash: string, now: Date): Promise<string | null>;
  markEmailVerified(userId: string, at: Date): Promise<void>;
  isEmailVerified(userId: string): Promise<boolean>;
  emailTaken(email: string): Promise<boolean>;
  referralCodeTaken(code: string): Promise<boolean>;
  salonSlugTaken(slug: string): Promise<boolean>;
  userIdByReferralCode(code: string): Promise<string | null>;
  createClient(data: NewClient): Promise<{ id: string; role: Role }>;
  /** Compte gérant + salon en attente de validation, dans une même transaction */
  createSalonOwner(data: NewSalonOwner): Promise<{ user: { id: string; role: Role }; salon: { id: string; slug: string; status: string } }>;
  saveLoginState(userId: string, state: LoginState): Promise<void>;
}

/** Générateur de liens secrets (aléatoire cryptographique) et empreinte stockée */
export interface TokenFactory {
  create(): { token: string; hash: string };
  hash(token: string): string;
}

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
  /** Comparaison factice : même temps de réponse qu'un compte existant (pas d'énumération des comptes) */
  burn(plain: string): Promise<void>;
}

/** Rattachement du personnel à un salon (lecture seule) */
export interface StaffDirectory {
  firstActiveSalonId(): Promise<string | null>;
  ownedSalonId(ownerId: string, salonId?: string): Promise<string | null>;
  employerSalonId(userId: string): Promise<string | null>;
  /** Fiche professionnelle liée au compte d'un employé (AUTH-07) */
  employeeOf(userId: string): Promise<{ id: string; key: string; name: string } | null>;
}
