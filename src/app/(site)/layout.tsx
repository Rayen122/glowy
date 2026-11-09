import { ChatbotWidget } from "@/components/ai/chatbot-widget";
import { InstallBanner } from "@/components/pwa/pwa";
import { SessionMark } from "@/components/pwa/session-mark";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { auth } from "@/auth";
import { getI18n } from "@/i18n/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ t }, session] = await Promise.all([getI18n(), auth()]);
  const user = session?.user ? { firstName: session.user.firstName, role: session.user.role } : null;
  return (
    <>
      <SessionMark userId={session?.user?.id} />
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {t.common.skipToContent}
      </a>
      <SiteHeader user={user} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <ChatbotWidget />
      <InstallBanner />
    </>
  );
}
