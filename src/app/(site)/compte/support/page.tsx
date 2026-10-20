import type { Metadata } from "next";
import { SupportPage } from "@/components/manage/support-page";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.support.title };
}

/** AVI-07 : tickets de support de la cliente */
export default async function ClientSupportPage({ searchParams }: PageProps<"/compte/support">) {
  const user = await requirePageUser("CLIENT");
  const { ticket } = await searchParams;
  return <SupportPage actor={user} ticketId={typeof ticket === "string" ? ticket : undefined} />;
}
