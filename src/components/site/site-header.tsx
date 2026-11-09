"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Palette, ScanFace, Store, UserRound } from "lucide-react";
import { homeForRole } from "@/auth.config";
import { NotificationBell } from "@/components/app-shell/notification-bell";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/i18n/client";
import type { CategoryId } from "@/lib/data";
import { cn } from "@/lib/utils";

const NAV: CategoryId[] = ["coiffure", "barbier", "ongles", "spa", "visage"];

/** Utilisateur connecté transmis par le layout serveur (null = visiteur) */
export type HeaderUser = { firstName: string; role: string } | null;

export function SiteHeader({ user }: { user: HeaderUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const chip = "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-200";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 w-full pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200",
          scrolled ? "bg-background/85 shadow-[0_1px_0_var(--border)] backdrop-blur-md" : "bg-background"
        )}
      >
        <div className="container-page flex h-16 items-center gap-2 sm:gap-6 lg:h-[72px] xl:gap-3">
          <Link href="/" aria-label={t.header.home} className="inline-flex min-h-11 shrink-0 items-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <Logo />
          </Link>

          {/* Liens resserrés (13 px) : la barre tient dans le conteneur de 1280 px, connectée et prénom compris */}
          <nav aria-label={t.header.categories} className="hidden items-center gap-0.5 whitespace-nowrap xl:flex">
            {NAV.map((id) => (
              <Link
                key={id}
                href={`/salons?categorie=${id}`}
                className="rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
              >
                {t.categories[id]}
              </Link>
            ))}
            <Link
              href="/analyse-beaute"
              className={cn(
                "ms-1 inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-200",
                pathname === "/analyse-beaute" ? "bg-blush text-plum-700" : "text-plum-700 hover:bg-blush"
              )}
            >
              <ScanFace className="size-4" aria-hidden />
              {t.header.aiAnalysis}
            </Link>
            <Link
              href="/essai-couleur"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-200",
                pathname === "/essai-couleur" ? "bg-blush text-plum-700" : "text-plum-700 hover:bg-blush"
              )}
            >
              <Palette className="size-4" aria-hidden />
              {t.header.tryOn}
            </Link>
            {/* Sans icône : avec, la barre déborderait du conteneur de 1280 px (visiteur, en français) */}
            <Link
              href="/invitations"
              className={cn(
                "rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-200",
                pathname === "/invitations" ? "bg-blush text-plum-700" : "text-plum-700 hover:bg-blush"
              )}
            >
              {t.header.invitations}
            </Link>
          </nav>

          <div className="ms-auto flex min-w-0 items-center gap-0.5 sm:gap-1.5">
            <LanguageSwitcher className="px-2 sm:px-3" />

            <Link
              href="/pro"
              className="hidden items-center gap-1.5 rounded-full px-2 py-2 text-[13px] font-medium whitespace-nowrap text-foreground transition-colors duration-200 hover:bg-muted xl:inline-flex"
            >
              <Store className="size-4" aria-hidden />
              {t.header.pro}
            </Link>
            {user && <NotificationBell />}
            {user ? (
              <Link
                href={homeForRole(user.role)}
                aria-label={user.firstName}
                className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-border bg-card ps-1 pe-1 text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:bg-muted min-[360px]:pe-3.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blush text-xs font-semibold text-plum-700">{user.firstName.charAt(0)}</span>
                {/* Sous 360 px : avatar seul, pour que la barre tienne sur les très petits écrans */}
                <span className="hidden max-w-28 truncate min-[360px]:inline xl:max-w-20">{user.firstName}</span>
              </Link>
            ) : (
              <Link
                href="/connexion"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-3.5 text-[13px] font-medium whitespace-nowrap text-white transition-colors duration-200 hover:bg-plum-800 sm:px-4 sm:text-sm"
              >
                <UserRound className="size-4 max-sm:hidden" aria-hidden />
                {t.header.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Écrans plus étroits : les mêmes liens que la barre du PC, sur une rangée qui défile horizontalement */}
      <nav aria-label={t.header.mobileMenu} className="border-b border-border bg-background xl:hidden">
        <div className="container-page no-scrollbar flex gap-1.5 overflow-x-auto py-2">
          {NAV.map((id) => (
            <Link key={id} href={`/salons?categorie=${id}`} className={cn(chip, "border border-border bg-card text-foreground hover:bg-muted")}>
              {t.categories[id]}
            </Link>
          ))}
          <Link
            href="/analyse-beaute"
            className={cn(chip, pathname === "/analyse-beaute" ? "bg-plum-700 text-white" : "bg-blush text-plum-700 hover:bg-plum-100")}
          >
            <ScanFace className="size-4" aria-hidden />
            {t.header.aiAnalysis}
          </Link>
          <Link
            href="/essai-couleur"
            className={cn(chip, pathname === "/essai-couleur" ? "bg-plum-700 text-white" : "bg-blush text-plum-700 hover:bg-plum-100")}
          >
            <Palette className="size-4" aria-hidden />
            {t.header.tryOn}
          </Link>
          <Link
            href="/invitations"
            className={cn(chip, pathname === "/invitations" ? "bg-plum-700 text-white" : "bg-blush text-plum-700 hover:bg-plum-100")}
          >
            <Heart className="size-4" aria-hidden />
            {t.header.invitations}
          </Link>
          <Link href="/pro" className={cn(chip, "border border-border bg-card text-foreground hover:bg-muted")}>
            <Store className="size-4" aria-hidden />
            {t.header.pro}
          </Link>
        </div>
      </nav>
    </>
  );
}
