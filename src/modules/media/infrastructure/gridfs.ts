import { Readable } from "node:stream";
import mongoose from "mongoose";
import { connectDb, objectId } from "@/infrastructure/db";
import type { MediaPurpose } from "../domain/policy";

/** Fichiers stockés dans MongoDB (GridFS, bucket « media ») : pas de service de stockage externe à configurer */

type MediaMeta = { owner: string | null; purpose: MediaPurpose; contentType: string; private: boolean };

async function bucket() {
  await connectDb();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "media" });
}

export async function storeFile(bytes: Uint8Array, filename: string, meta: MediaMeta) {
  const media = await bucket();
  const upload = media.openUploadStream(filename, { metadata: meta });
  await new Promise<void>((resolve, reject) => {
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(Buffer.from(bytes));
  });
  return upload.id.toString();
}

export async function findFile(id: string) {
  const _id = objectId(id);
  if (!_id) return null;
  const file = await (await bucket()).find({ _id }).next();
  if (!file) return null;
  const meta = (file.metadata ?? {}) as Partial<MediaMeta>;
  return { id, filename: file.filename, length: file.length, uploadedAt: file.uploadDate, owner: meta.owner ?? null, purpose: meta.purpose ?? "salon", contentType: meta.contentType ?? "application/octet-stream", private: Boolean(meta.private) };
}

export async function openFile(id: string) {
  const stream = (await bucket()).openDownloadStream(objectId(id)!);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function removeFile(id: string) {
  await (await bucket()).delete(objectId(id)!);
}
