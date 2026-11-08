import type { Viewport } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthStage } from "@/components/auth/auth-stage";
import { getI18n } from "@/i18n/server";
import { platformShowcase } from "@/modules/catalog";

/** Pages sombres : barre d'état du téléphone de la même couleur que le haut de la scène (au lieu de la bande ivoire) */
export const viewport: Viewport = { themeColor: "#331e33" };

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [{ t, locale }, showcase] = await Promise.all([getI18n(), platformShowcase()]);
  return (
    <div className="min-h-dvh overflow-x-clip bg-ink lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      {/* key = langue : la scène et la carte sont remontées (animations recalculées) quand la langue change */}
      <AuthStage key={`stage-${locale}`} verifiedSalons={showcase.salons} topSalon={showcase.featured ? { name: showcase.featured.name, rating: showcase.featured.rating } : null} />
      <div className="relative isolate -mt-24 px-4 pb-10 sm:px-8 lg:mt-0 lg:flex lg:min-h-dvh lg:flex-col lg:justify-center lg:py-12">
        <div
          className="pointer-events-none absolute top-1/3 left-1/2 -z-10 size-[360px] -translate-x-1/2 rounded-full bg-plum-700/30 blur-[120px] sm:size-[520px] sm:blur-[140px]"
          aria-hidden
        />
        <main>
          <AuthCard key={`card-${locale}`}>{children}</AuthCard>
        </main>
        <p className="mt-8 text-center text-xs text-white/45">{t.auth.footer}</p>
      </div>
    </div>
  );
}
