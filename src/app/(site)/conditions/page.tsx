import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { LEGAL } from "@/content/legal";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: LEGAL.conditions[locale].title };
}

export default function Page() {
  return <LegalPage slug="conditions" />;
}
