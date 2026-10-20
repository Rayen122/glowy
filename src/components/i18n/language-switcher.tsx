"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEnabledLocales, useI18n } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALE_META, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Sélecteur de langue : mémorisé dans un cookie, la page est re-rendue côté serveur. */
export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const { locale, t } = useI18n();
  const locales = useEnabledLocales();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = LOCALE_META[next].dir;
    startTransition(() => router.refresh());
  };

  if (locales.length < 2) return null; // une seule langue activée : pas de sélecteur

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.common.language}
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          tone === "dark" ? "text-white/90 hover:bg-white/10" : "text-foreground hover:bg-muted",
          pending && "opacity-60",
          className
        )}
      >
        <Globe className="size-[18px]" aria-hidden />
        <span className="text-xs font-bold">{LOCALE_META[locale].short}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => change(v as Locale)}>
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l} dir={LOCALE_META[l].dir} closeOnClick>
              {LOCALE_META[l].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
