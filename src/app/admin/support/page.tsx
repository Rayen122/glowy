import type { Metadata } from "next";
import { SupportPage } from "@/components/manage/support-page";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.support.adminTitle };
}

/** AVI-07 : file des tickets du Super Admin */
export default async function AdminSupportPage({ searchParams }: PageProps<"/admin/support">) {
  const user = await requirePageUser("ADMIN");
  const { ticket, filtre } = await searchParams;
  return <SupportPage actor={user} ticketId={typeof ticket === "string" ? ticket : undefined} filter={typeof filtre === "string" ? filtre : undefined} />;
}
