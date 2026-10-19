import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/manage/password-forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.password.resetTitle };
}

/** AUTH-05 : choix du nouveau mot de passe depuis le lien reçu (?token=…) */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reinitialiser">) {
  const { token } = await searchParams;
  const { t } = await getI18n();
  const m = t.manage.password;
  return (
    <>
      <h1 className="text-[2rem] leading-[1.05] font-bold tracking-[-0.035em] text-ink sm:text-4xl">{m.resetTitle}</h1>
      <p data-auth-item className="mt-3 mb-8 text-muted-foreground">
        {m.resetLead}
      </p>
      <ResetPasswordForm token={typeof token === "string" && token.length >= 20 ? token : null} />
    </>
  );
}
