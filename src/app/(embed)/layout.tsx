import { SessionMark } from "@/components/pwa/session-mark";
import { SiteHeader } from "@/components/site/site-header";
import { auth } from "@/auth";
import { getI18n } from "@/i18n/server";

/**
 * Site partenaire affiché dans Glowy (/invitations) : l'en-tête du site, puis le partenaire sur toute la hauteur
 * restante de l'écran. Ni pied de page, ni assistante, ni bannière d'installation par-dessus.
 */
export default async function EmbedLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, session] = await Promise.all([getI18n(), auth()]);
  const user = session?.user ? { firstName: session.user.firstName, role: session.user.role } : null;
  return (
    <div className="flex h-dvh flex-col">
      <SessionMark userId={session?.user?.id} />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {t.common.skipToContent}
      </a>
      <SiteHeader user={user} />
      <main id="contenu" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
