import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/app-shell/module-placeholder";
import { getI18n } from "@/i18n/server";
import { ADMIN_MODULES } from "@/lib/modules";

export const dynamicParams = false;

export function generateStaticParams() {
  return ADMIN_MODULES.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: PageProps<"/admin/[module]">): Promise<Metadata> {
  const { module } = await params;
  const def = ADMIN_MODULES.find((m) => m.slug === module);
  if (!def) return {};
  const { t } = await getI18n();
  return { title: t.modules.admin[def.slug].title };
}

export default async function AdminModulePage({ params }: PageProps<"/admin/[module]">) {
  const { module } = await params;
  const def = ADMIN_MODULES.find((m) => m.slug === module);
  if (!def) notFound();
  const { t } = await getI18n();
  const text = t.modules.admin[def.slug];
  return <ModulePlaceholder module={def} title={text.title} description={text.description} backHref="/admin" />;
}
