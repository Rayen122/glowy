import type { Metadata } from "next";
import { ExternalLink, Heart } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { FARHTY_URL } from "@/lib/farhty";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.invitationsPage.metaTitle, description: t.invitationsPage.metaDescription };
}

/**
 * Farhty (invitations de mariage) affiché dans Glowy. Permissions confiées au cadre : caméra (scan des invités à
 * l'entrée), lecture de la musique de l'invitation, copie et partage du lien. Le cadre ne peut pas faire changer
 * de page à Glowy (pas de `allow-top-navigation`) ; ses liens externes s'ouvrent dans un nouvel onglet.
 */
export default async function InvitationsPage() {
  const { t } = await getI18n();
  const p = t.invitationsPage;
  return (
    <>
      <div className="container-page flex items-center gap-3 py-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blush text-plum-700">
          <Heart className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-ink">{p.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{p.lead}</p>
        </div>
        <a
          href={`${FARHTY_URL}/?source=glowy`}
          target="_blank"
          rel="noopener"
          aria-label={p.openHint}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-200 hover:bg-muted"
        >
          <ExternalLink className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{p.open}</span>
        </a>
      </div>
      <iframe
        src={`${FARHTY_URL}/?source=glowy`}
        title={p.frameTitle}
        allow="camera; autoplay; clipboard-write; web-share; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
        referrerPolicy="strict-origin-when-cross-origin"
        className="min-h-0 w-full flex-1 border-t border-border bg-white"
      />
    </>
  );
}
