"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Favori (CLI-03) : mise à jour optimiste, enregistrée via PUT /api/me/favorites ; visiteur → connexion */
export function FavoriteButton({
  salonName,
  salonSlug,
  initial = false,
  className,
  variant = "overlay",
}: {
  salonName: string;
  salonSlug: string;
  initial?: boolean;
  className?: string;
  variant?: "overlay" | "outline";
}) {
  const { t, f } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(initial);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    const next = !active;
    setActive(next);
    setPending(true);
    try {
      await api("/api/me/favorites", { method: "PUT", body: { salonSlug, favorite: next } });
      toast(next ? t.favorites.added : t.favorites.removed, { description: salonName });
    } catch (error) {
      setActive(!next);
      if (error instanceof ApiError && error.status === 401) router.push(`/connexion?callbackUrl=${encodeURIComponent(pathname)}`);
      else toast.error(t.errors.generic);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-busy={pending}
      aria-label={f(active ? t.favorites.removeAria : t.favorites.addAria, { name: salonName })}
      onClick={() => void toggle()}
      className={cn(
        "relative z-10 inline-flex size-10 items-center justify-center rounded-full transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        variant === "overlay"
          ? "bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white"
          : "border border-border bg-card text-foreground hover:bg-muted",
        className
      )}
    >
      <Heart className={cn("size-[18px] transition-colors", active && "fill-plum-600 text-plum-600")} aria-hidden />
    </button>
  );
}
