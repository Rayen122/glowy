import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { PwaRegister } from "@/components/pwa/pwa";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/client";
import { LOCALE_META } from "@/i18n/config";
import { getDictionary, getEnabledLocales, getI18n, getLocale } from "@/i18n/server";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  // Téléchargée seulement quand une page contient de l'arabe (unicode-range), pas préchargée en FR / EN
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: "%s · Glowy" },
    description: t.meta.description,
    applicationName: "Glowy",
    appleWebApp: { capable: true, title: "Glowy", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#fbf7f4",
  width: "device-width",
  initialScale: 1,
  /** Plein écran sur iPhone (encoche, barre d'accueil) : les marges env(safe-area-inset-*) sont gérées dans la mise en page */
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, locales] = await Promise.all([getLocale(), getEnabledLocales()]);
  const dict = await getDictionary(locale);

  return (
    <html
      lang={locale}
      dir={LOCALE_META[locale].dir}
      data-scroll-behavior="smooth"
      className={`${jakarta.variable} ${plexArabic.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <noscript>
          <style
            dangerouslySetInnerHTML={{
              __html: "[data-animate],[data-animate]>*,[data-hero],[data-auth-card]{visibility:visible!important}",
            }}
          />
        </noscript>
        <I18nProvider locale={locale} dict={dict} locales={locales}>
          <TooltipProvider>{children}</TooltipProvider>
          <PwaRegister />
          <Toaster theme="light" position="top-center" dir={LOCALE_META[locale].dir} richColors={false} />
        </I18nProvider>
      </body>
    </html>
  );
}
