import type { DefaultSession } from "next-auth";
import type { Role } from "@/core/domain/actor";

declare module "next-auth" {
  interface User {
    role: Role;
    firstName: string;
  }
  interface Session {
    user: { id: string; role: Role; firstName: string } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    firstName: string;
  }
}
