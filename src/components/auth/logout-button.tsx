"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

/** Déconnexion (AUTH-03) : supprime le cookie de session puis revient à l'accueil */
export function LogoutButton({ label, className, iconOnly }: { label: string; className?: string; iconOnly?: boolean }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={iconOnly ? label : undefined}
      onClick={() => {
        setPending(true);
        void signOut({ redirectTo: "/" });
      }}
      className={cn("disabled:opacity-60", className)}
    >
      <LogOut className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
      {!iconOnly && label}
    </button>
  );
}
