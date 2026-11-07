import type { DefaultSession } from "next-auth";
import type { Role } from "@/core/domain/actor";

declare module "next-auth" {
  interface User {
    role: Role;
    firstName: string;
  }
  interface Session {
    /** authAt : heure de connexion (ms), comparée au dernier changement de mot de passe */
    user: { id: string; role: Role; firstName: string; authAt?: number } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    firstName: string;
    authAt?: number;
  }
}
