import Link from "next/link";
import { SearchX } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";

/**
 * Page introuvable (404), traduite et au thème du site : remplace la page anglaise par défaut de Next.js.
 * `standalone` : adresse inconnue hors du site (pas d'en-tête autour), d'où le logo.
 */
export async function NotFoundContent({ standalone = false }: { standalone?: boolean }) {
  const { t } = await getI18n();
  const n = t.notFound;
  return (
    <div className={standalone ? "flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-12 text-center" : "container-page flex flex-col items-center gap-6 py-20 text-center sm:py-28"}>
      <title>{`${n.title} · Glowy`}</title>
      {standalone && <LogoMark className="size-14" />}
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blush text-plum-700">
        <SearchX className="size-7" aria-hidden />
      </span>
      <div className="max-w-md">
        <p className="eyebrow">404</p>
        <h1 className="display mt-2 text-3xl text-ink sm:text-4xl">{n.title}</h1>
        <p className="mt-3 text-muted-foreground">{n.text}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/salons" className="inline-flex h-12 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
          {n.findSalon}
        </Link>
        <Link href="/" className="inline-flex h-12 items-center rounded-full border border-border bg-card px-6 text-sm font-semibold hover:bg-muted">
          {n.home}
        </Link>
      </div>
    </div>
  );
}
