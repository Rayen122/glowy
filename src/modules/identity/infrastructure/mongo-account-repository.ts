import { idOf, objectId, Salon, User, withTransaction, type UserDoc } from "@/infrastructure/db";
import type { AccountRepository, UserAccount } from "../application/ports";

const toAccount = (u: UserDoc): UserAccount => ({
  id: idOf(u),
  email: u.email,
  role: u.role,
  status: u.status,
  firstName: u.firstName,
  lastName: u.lastName,
  avatarUrl: u.avatarUrl ?? null,
  passwordHash: u.passwordHash ?? null,
  failedLogins: u.failedLogins,
  lockedUntil: u.lockedUntil ?? null,
});

export const mongoAccountRepository: AccountRepository = {
  async findByEmail(email) {
    const user = await User.findOne({ email }).lean<UserDoc>();
    return user ? toAccount(user) : null;
  },
  async findByRole(role, email) {
    const user = await User.findOne({ email, role }).lean<UserDoc>();
    return user ? toAccount(user) : null;
  },
  async findById(id) {
    const _id = objectId(id);
    const user = _id ? await User.findById(_id).lean<UserDoc>() : null;
    return user ? toAccount(user) : null;
  },
  emailTaken: async (email) => (await User.exists({ email })) !== null,
  referralCodeTaken: async (code) => (await User.exists({ referralCode: code })) !== null,
  salonSlugTaken: async (slug) => (await Salon.exists({ slug })) !== null,
  userIdByReferralCode: async (code) => {
    const found = await User.exists({ referralCode: code });
    return found ? idOf(found) : null;
  },

  async createStaffUser(data) {
    const user = await User.create({ ...data, role: "EMPLOYEE" });
    return { id: idOf(user) };
  },

  setPasswordHash: async (userId, passwordHash) => {
    await User.updateOne({ _id: objectId(userId) }, { $set: { passwordHash, failedLogins: 0, lockedUntil: null } });
  },

  async createClient(data) {
    const user = await User.create({ ...data, referredBy: objectId(data.referredById) });
    return { id: idOf(user), role: user.role };
  },

  createSalonOwner: ({ owner, salon }) =>
    withTransaction(async (session) => {
      const [user] = await User.create(
        [{ email: owner.email, passwordHash: owner.passwordHash, firstName: owner.name, lastName: "", phone: owner.phone, role: "MANAGER", locale: owner.locale, referralCode: owner.referralCode }],
        { session }
      );
      const [created] = await Salon.create([{ ...salon, specialties: [], owner: user._id }], { session });
      return { user: { id: idOf(user), role: user.role }, salon: { id: idOf(created), slug: created.slug, status: created.status } };
    }),

  saveLoginState: async (userId, state) => {
    await User.updateOne({ _id: objectId(userId) }, { $set: state });
  },
};
