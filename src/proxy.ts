import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig, homeForRole } from "./auth.config";

/**
 * Vérification rapide des accès par rôle (AUTH-04), à partir du cookie de session uniquement.
 * Le contrôle définitif est refait côté serveur dans chaque page et chaque API (src/server/session.ts).
 */
const { auth } = NextAuth(authConfig);

const RULES: { prefix: string; roles?: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/dashboard", roles: ["MANAGER", "EMPLOYEE", "ADMIN"] },
  { prefix: "/compte" },
];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return;

  const user = request.auth?.user;
  if (!user) {
    const url = new URL("/connexion", request.nextUrl);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (rule.roles && !rule.roles.includes(user.role)) {
    return NextResponse.redirect(new URL(homeForRole(user.role), request.nextUrl));
  }
});

export const config = {
  matcher: ["/compte/:path*", "/dashboard/:path*", "/admin/:path*"],
};
