import { z } from "zod";
import { badRequest } from "@/core/domain/errors";
import { ok, route } from "@/infrastructure/http";
import { currentActor } from "@/infrastructure/session";
import { MEDIA_PURPOSES, uploadMedia } from "@/modules/media";

const purposeSchema = z.enum(MEDIA_PURPOSES);

/** POST /api/media — formulaire multipart { file, purpose } → { id, url } (JPG, PNG, WebP ; PDF pour un justificatif) */
export const POST = route(async (request) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("NO_FILE", "Aucun fichier reçu.");
  const purpose = purposeSchema.parse(form?.get("purpose") ?? "salon");
  const media = await uploadMedia(await currentActor(), purpose, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  return ok(media, { status: 201 });
});
