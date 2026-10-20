import type { Metadata } from "next";
import { SupportPage } from "@/components/manage/support-page";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.support.title };
}

/** AVI-07 : tickets de support de l'équipe du salon */
export default async function SalonSupportPage({ searchParams }: PageProps<"/dashboard/support">) {
  const user = await requirePageUser("MANAGER", "EMPLOYEE");
  const { ticket } = await searchParams;
  return <SupportPage actor={user} ticketId={typeof ticket === "string" ? ticket : undefined} />;
}
