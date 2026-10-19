import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/manage/password-forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.password.forgotTitle };
}

/** AUTH-05 : demande d'un lien de réinitialisation du mot de passe */
export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  const m = t.manage.password;
  return (
    <>
      <h1 className="text-[2rem] leading-[1.05] font-bold tracking-[-0.035em] text-ink sm:text-4xl">{m.forgotTitle}</h1>
      <p data-auth-item className="mt-3 mb-8 text-muted-foreground">
        {m.forgotLead}
      </p>
      <ForgotPasswordForm />
    </>
  );
}
