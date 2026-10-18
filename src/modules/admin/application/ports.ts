import type { PlanId, SalonStatus, UserStatus } from "@/core/domain/enums";

export type AdminSalon = { id: string; name: string; status: SalonStatus; verified: boolean; plan: PlanId };
export type Audit = { actorId: string; action: string; targetType: string; targetId: string; meta?: Record<string, unknown> };

export interface AdminRepository {
  findSalon(id: string): Promise<AdminSalon | null>;
  /** Nouveau statut + ligne d'audit, d'un seul tenant */
  updateSalon(id: string, data: { status: SalonStatus; verified?: boolean }, audit: Audit): Promise<AdminSalon>;
  findUser(id: string): Promise<{ id: string; email: string } | null>;
  updateUserStatus(id: string, status: UserStatus, audit: Audit): Promise<{ id: string; status: UserStatus }>;
}
