import { AuditLog, idOf, objectId, Salon, User, withTransaction } from "@/infrastructure/db";
import type { AdminRepository, AdminSalon, Audit } from "../application/ports";

const toSalon = (s: { _id: never } & Omit<AdminSalon, "id">): AdminSalon => ({ id: idOf(s), name: s.name, status: s.status, verified: s.verified, plan: s.plan });
const auditDoc = (a: Audit) => ({ actor: objectId(a.actorId), action: a.action, targetType: a.targetType, targetId: a.targetId, meta: a.meta ?? null });

export const mongoAdminRepository: AdminRepository = {
  async findSalon(id) {
    const _id = objectId(id);
    const salon = _id ? await Salon.findById(_id, { name: 1, status: 1, verified: 1, plan: 1 }).lean() : null;
    return salon ? { id: idOf(salon), name: salon.name, status: salon.status, verified: salon.verified, plan: salon.plan } : null;
  },
  updateSalon: (id, data, audit) =>
    withTransaction(async (session) => {
      const salon = await Salon.findByIdAndUpdate(objectId(id), { $set: data }, { session, returnDocument: "after", projection: { name: 1, status: 1, verified: 1, plan: 1 } }).orFail().lean();
      await AuditLog.create([auditDoc(audit)], { session });
      return { id: idOf(salon), name: salon.name, status: salon.status, verified: salon.verified, plan: salon.plan };
    }),
  async findUser(id) {
    const _id = objectId(id);
    const user = _id ? await User.findById(_id, { email: 1 }).lean() : null;
    return user ? { id: idOf(user), email: user.email } : null;
  },
  updateUserStatus: (id, status, audit) =>
    withTransaction(async (session) => {
      await AuditLog.create([auditDoc(audit)], { session });
      const user = await User.findByIdAndUpdate(objectId(id), { $set: { status } }, { session, returnDocument: "after", projection: { status: 1 } }).orFail().lean();
      return { id: idOf(user), status: user.status };
    }),
};

export { toSalon };
