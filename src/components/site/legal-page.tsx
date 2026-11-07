import Link from "next/link";
import { Info } from "lucide-react";
import { LEGAL, type LegalSlug } from "@/content/legal";
import { getI18n } from "@/i18n/server";

/** Page légale (conditions d'utilisation, confidentialité) dans la langue de l'interface */
export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const { t, locale } = await getI18n();
  const doc = LEGAL[slug][locale];
  const other: LegalSlug = slug === "conditions" ? "confidentialite" : "conditions";
  return (
    <article className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="display text-4xl text-ink sm:text-5xl">{doc.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{doc.updated}</p>
      <p className="mt-6 flex gap-2.5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-plum-600" aria-hidden />
        {doc.draft}
      </p>
      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-foreground">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-12 border-t border-border pt-6 text-sm">
        <Link href={`/${other}`} className="font-semibold text-plum-700 hover:underline">
          {LEGAL[other][locale].title}
        </Link>
        {" · "}
        <Link href="/compte/support" className="font-semibold text-plum-700 hover:underline">
          {t.legal.contact}
        </Link>
      </p>
    </article>
  );
}
