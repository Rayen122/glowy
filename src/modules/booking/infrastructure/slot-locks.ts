import type { Types } from "mongoose";
import { isDuplicateKey, SlotLock } from "@/infrastructure/db";
import { lockSlices } from "../domain/policy";

type Owner = { booking: Types.ObjectId } | { timeOff: Types.ObjectId };

/**
 * Verrouille les tranches [start, end[ d'un employé pour une réservation ou un congé.
 * Renvoie false (et ne laisse rien derrière) si une tranche appartient déjà à quelqu'un :
 * l'index unique (employé, tranche) tranche entre deux demandes simultanées.
 */
export async function acquireSlices(employee: Types.ObjectId, start: Date, end: Date, owner: Owner, skip: Set<number> = new Set()) {
  const docs = lockSlices(start, end)
    .filter((at) => !skip.has(at.getTime()))
    .map((at) => ({ employee, at, ...owner }));
  if (!docs.length) return true;
  try {
    await SlotLock.insertMany(docs, { ordered: true });
    return true;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await SlotLock.deleteMany({ ...owner, at: { $in: docs.map((d) => d.at) } });
    return false;
  }
}

export const releaseSlices = (owner: Owner) => SlotLock.deleteMany(owner);
