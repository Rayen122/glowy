/**
 * Module Identité (P1) — API publique. Les pages, routes et autres modules importent uniquement ce fichier.
 * Câblage (composition) : cas d'usage ← dépôts MongoDB (Mongoose), bcrypt, bus d'événements, horloge système.
 */
import { systemClock } from "@/core/domain/clock";
import { eventBus } from "@/infrastructure/event-bus";
import { makeAccess } from "./application/access";
import { makeIdentity } from "./application/use-cases";
import { sendEmail } from "@/modules/notifications";
import { bcryptPasswordHasher } from "./infrastructure/bcrypt-password-hasher";
import { cryptoTokens } from "./infrastructure/crypto-tokens";
import { mongoAccountRepository } from "./infrastructure/mongo-account-repository";
import { mongoStaffDirectory } from "./infrastructure/mongo-staff-directory";

export const { staffSalonId, canManageSalon } = makeAccess(mongoStaffDirectory);
export const { register, authenticate, demoAccount, sessionUser, createStaffAccount, requestPasswordReset, resetPassword, sendEmailVerification, verifyEmail, changePassword, oauthSignIn } = makeIdentity({
  accounts: mongoAccountRepository,
  hasher: bcryptPasswordHasher,
  events: eventBus,
  clock: systemClock,
  tokens: cryptoTokens,
  mailer: { send: sendEmail },
});

export { changePasswordInput, credentialsInput, forgotPasswordInput, registerInput, resetPasswordInput, verifyEmailInput, type RegisterInput } from "./application/schemas";
export type { SalonAccess } from "./application/access";
export type { UserAccount } from "./application/ports";
export { LOGIN_POLICY } from "./domain/account";
export { hashPassword } from "./infrastructure/bcrypt-password-hasher";
