import { createHash, randomBytes } from "node:crypto";
import type { TokenFactory } from "../application/ports";

/** Jeton de 256 bits en base64url ; seule son empreinte SHA-256 est enregistrée en base */
export const cryptoTokens: TokenFactory = {
  create() {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: createHash("sha256").update(token).digest("hex") };
  },
  hash: (token) => createHash("sha256").update(token).digest("hex"),
};
