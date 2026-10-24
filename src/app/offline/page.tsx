import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { OfflinePages } from "@/components/pwa/offline-pages";
import { RetryButton } from "@/components/pwa/retry-button";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.pwa.offline.title, robots: { index: false } };
}

/** Page affichée par le service worker quand une page n'est pas disponible hors connexion, avec les pages enregistrées */
export default async function OfflinePage() {
  const { t } = await getI18n();
  const o = t.pwa.offline;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <LogoMark className="size-14" />
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blush text-plum-700">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <div className="max-w-sm">
        <h1 className="display text-3xl text-ink">{o.title}</h1>
        <p className="mt-3 text-muted-foreground">{o.text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <RetryButton label={o.retry} />
        <Link href="/" className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold hover:bg-muted">
          {o.home}
        </Link>
      </div>
      <OfflinePages heading={o.available} />
    </main>
  );
}
