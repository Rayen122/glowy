import { Employee, idOf, objectId, Salon } from "@/infrastructure/db";
import type { StaffDirectory } from "../application/ports";

export const mongoStaffDirectory: StaffDirectory = {
  firstActiveSalonId: async () => {
    const salon = await Salon.findOne({ status: "ACTIVE" }, { _id: 1 }).sort({ createdAt: 1 }).lean();
    return salon ? idOf(salon) : null;
  },
  ownedSalonId: async (ownerId, salonId) => {
    const owner = objectId(ownerId);
    if (!owner || (salonId && !objectId(salonId))) return null;
    const salon = await Salon.findOne({ owner, ...(salonId ? { _id: objectId(salonId) } : {}) }, { _id: 1 }).sort({ createdAt: 1 }).lean();
    return salon ? idOf(salon) : null;
  },
  employerSalonId: async (userId) => {
    const user = objectId(userId);
    const employee = user ? await Employee.findOne({ user }, { salon: 1 }).lean() : null;
    return employee ? employee.salon.toString() : null;
  },
  employeeOf: async (userId) => {
    const user = objectId(userId);
    const employee = user ? await Employee.findOne({ user }, { key: 1, name: 1 }).lean() : null;
    return employee ? { id: idOf(employee), key: employee.key, name: employee.name } : null;
  },
};
