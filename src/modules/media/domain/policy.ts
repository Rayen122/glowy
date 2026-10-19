import { badRequest } from "@/core/domain/errors";

/** Fichiers envoyés par les utilisateurs (photos de salon, portfolio, avis, justificatif, analyse beauté) — règles pures. */

export const MEDIA_PURPOSES = ["salon", "review", "avatar", "document", "analysis"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

/** Les justificatifs et les photos d'analyse ne sont visibles que par leur propriétaire (et le Super Admin) — cahier §10 */
export const PRIVATE_PURPOSES: readonly MediaPurpose[] = ["document", "analysis"];

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const LIMITS: Record<MediaPurpose, { types: readonly string[]; maxBytes: number }> = {
  salon: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  review: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  avatar: { types: IMAGE_TYPES, maxBytes: 2 * 1024 * 1024 },
  analysis: { types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024 },
  document: { types: [...IMAGE_TYPES, "application/pdf"], maxBytes: 8 * 1024 * 1024 },
};

/** Type réel d'après les premiers octets du fichier : on ne fait jamais confiance à l'extension ou au type annoncé */
export function sniffType(bytes: Uint8Array): string | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}

export function assertAcceptable(purpose: MediaPurpose, bytes: Uint8Array) {
  const limit = LIMITS[purpose];
  if (bytes.byteLength === 0) throw badRequest("EMPTY_FILE", "Le fichier est vide.");
  if (bytes.byteLength > limit.maxBytes) throw badRequest("FILE_TOO_LARGE", `Fichier trop lourd (maximum ${Math.round(limit.maxBytes / 1024 / 1024)} Mo).`);
  const type = sniffType(bytes);
  if (!type || !limit.types.includes(type)) throw badRequest("FILE_TYPE", "Format non accepté : JPG, PNG ou WebP (PDF pour un justificatif).");
  return type;
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition */
export const safeFilename = (name: string) => name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "fichier";
