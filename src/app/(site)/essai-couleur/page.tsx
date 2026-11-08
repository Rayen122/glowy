import type { Metadata } from "next";
import { HairTryOn } from "@/components/ai/hair-try-on";
import { getI18n } from "@/i18n/server";
import { proRenderEnabled } from "@/modules/beauty";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.tryOnPage.metaTitle, description: t.tryOnPage.metaDescription };
}

/** Essai virtuel de couleur : segmentation des cheveux par IA dans le navigateur, puis recoloration ; rendu photoréaliste (Gemini) à la demande */
export default async function TryOnPage() {
  const { t } = await getI18n();
  const p = t.tryOnPage;
  return (
    <div className="container-page pt-8 pb-20 lg:pt-12">
      <div className="max-w-2xl">
        <p data-animate="fade-up" className="eyebrow">
          {p.eyebrow}
        </p>
        <h1 data-animate="split" className="display mt-3 text-4xl text-ink sm:text-5xl lg:text-6xl">
          {p.titleStart} <em className="text-plum-600">{p.titleEm}</em>
        </h1>
        <p data-animate="fade-up" className="mt-5 text-lg leading-relaxed text-muted-foreground">
          {p.lead}
        </p>
      </div>
      <div data-animate="fade-up" className="mt-10">
        <HairTryOn proEnabled={proRenderEnabled()} />
      </div>
    </div>
  );
}
