/**
 * Module Médias — envoi et lecture des fichiers des utilisateurs (photos, portfolio, justificatifs, analyses).
 * Les fichiers privés (justificatif, photo d'analyse) ne sont lisibles que par leur propriétaire et le Super Admin.
 */
import type { Actor } from "@/core/domain/actor";
import { forbidden, notFound } from "@/core/domain/errors";
import { assertSafeImage } from "@/modules/moderation";
import { assertAcceptable, MODERATED_PURPOSES, PRIVATE_PURPOSES, safeFilename, type MediaPurpose } from "./domain/policy";
import { findFile, openFile, removeFile, storeFile } from "./infrastructure/gridfs";

export const mediaUrl = (id: string) => `/api/media/${id}`;

/** Enregistre un fichier envoyé ; un visiteur non connecté ne peut envoyer qu'un justificatif (inscription d'un salon) */
export async function uploadMedia(actor: Actor | null, purpose: MediaPurpose, file: { name: string; bytes: Uint8Array }) {
  if (!actor && purpose !== "document") throw forbidden("Connectez-vous pour envoyer une photo.");
  // Photos de salon (vitrine, galerie, équipe) : réservées à l'équipe du salon et au Super Admin
  if (purpose === "salon" && actor?.role === "CLIENT") throw forbidden("Seule l'équipe du salon peut envoyer des photos du salon.");
  const contentType = assertAcceptable(purpose, file.bytes);
  if (MODERATED_PURPOSES.includes(purpose)) await assertSafeImage(file.bytes, contentType);
  const id = await storeFile(file.bytes, safeFilename(file.name), { owner: actor?.id ?? null, purpose, contentType, private: PRIVATE_PURPOSES.includes(purpose) });
  return { id, url: mediaUrl(id), contentType };
}

/** Lecture : publique, ou réservée au propriétaire et au Super Admin pour un fichier privé */
export async function readMedia(actor: Actor | null, id: string) {
  const file = await findFile(id);
  if (!file) throw notFound("Fichier introuvable.");
  if (file.private && !(actor && (actor.role === "ADMIN" || actor.id === file.owner))) throw notFound("Fichier introuvable.");
  return { ...file, body: await openFile(id) };
}

/** Suppression par son propriétaire (« supprimer ma photo à tout moment », cahier §4.1) ou par le Super Admin */
export async function deleteMedia(actor: Actor, id: string) {
  const file = await findFile(id);
  if (!file) throw notFound("Fichier introuvable.");
  if (actor.role !== "ADMIN" && actor.id !== file.owner) throw forbidden();
  await removeFile(id);
  return { id };
}

export { MEDIA_PURPOSES, type MediaPurpose } from "./domain/policy";
