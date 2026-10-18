import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../application/ports";

/** Coût 12 : ~250 ms par vérification, frein suffisant contre les attaques par force brute */
const COST = 12;
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8m6S6rF8pQ1h3c5qPpG2y1i5W3n9Cy";

export const bcryptPasswordHasher: PasswordHasher = {
  hash: (plain) => bcrypt.hash(plain, COST),
  verify: (plain, hash) => bcrypt.compare(plain, hash),
  burn: async (plain) => {
    await bcrypt.compare(plain, DUMMY_HASH);
  },
};

/** Hachage direct (données de démonstration) */
export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);
