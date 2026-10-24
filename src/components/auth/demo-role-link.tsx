"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { forgetOfflinePages } from "@/components/pwa/pwa";

type DemoRole = "CLIENT" | "MANAGER" | "ADMIN";

/**
 * Lien vers un espace de démonstration (client, dashboard salon, Super Admin). Avec la connexion démo active,
 * il se connecte d'abord au compte démo du bon rôle : sinon un Super Admin déjà connecté ouvrait
 * le dashboard salon avec son propre compte. Sans connexion démo : simple lien (connexion demandée).
 */
export function DemoRoleLink({ role, href, demoEnabled, className, children }: { role: DemoRole; href: string; demoEnabled: boolean; className?: string; children: ReactNode }) {
  const [pending, setPending] = useState(false);
  if (!demoEnabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      aria-busy={pending || undefined}
      onClick={async (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        if (pending) return;
        setPending(true);
        forgetOfflinePages();
        const result = await signIn("demo", { role, redirect: false });
        // Rechargement complet : la nouvelle session est lue partout (après signIn, router.push annulait la navigation)
        window.location.assign(result && !result.error ? href : `/connexion?callbackUrl=${encodeURIComponent(href)}`);
      }}
      className={className}
    >
      {children}
    </a>
  );
}
