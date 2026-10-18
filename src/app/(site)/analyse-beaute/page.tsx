import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { BeautyAnalysis } from "@/components/ai/beauty-analysis";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.analysisPage.metaTitle, description: t.analysisPage.metaDescription };
}

export default async function AnalysePage() {
  const { t } = await getI18n();
  const p = t.analysisPage;
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
        <p data-animate="fade-up" className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4 shrink-0 text-plum-600" aria-hidden />
          {p.privacy}
        </p>
      </div>
      <div data-animate="fade-up" className="mt-10">
        <BeautyAnalysis />
      </div>
    </div>
  );
}
