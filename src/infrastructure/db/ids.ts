import { Types } from "mongoose";

/** Identifiant reçu d'une URL ou d'un formulaire → ObjectId, ou null s'il est mal formé (évite les CastError) */
export const objectId = (id: string | null | undefined) => (id && /^[a-f\d]{24}$/i.test(id) ? new Types.ObjectId(id) : null);

export const idOf = (value: { _id: Types.ObjectId } | Types.ObjectId) => (value instanceof Types.ObjectId ? value : value._id).toString();

