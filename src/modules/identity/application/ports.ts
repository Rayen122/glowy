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
  emailTaken(email: string): Promise<boolean>;
  referralCodeTaken(code: string): Promise<boolean>;
  salonSlugTaken(slug: string): Promise<boolean>;
  userIdByReferralCode(code: string): Promise<string | null>;
  createClient(data: NewClient): Promise<{ id: string; role: Role }>;
  /** Compte gérant + salon en attente de validation, dans une même transaction */
  createSalonOwner(data: NewSalonOwner): Promise<{ user: { id: string; role: Role }; salon: { id: string; slug: string; status: string } }>;
  saveLoginState(userId: string, state: LoginState): Promise<void>;
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
}
