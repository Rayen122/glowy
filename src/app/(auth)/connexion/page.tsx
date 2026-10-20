import type { Metadata } from "next";
import { demoLoginEnabled, googleLoginEnabled } from "@/auth";
import { LoginForm } from "@/components/site/auth-forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.login.metaTitle };
}

export default async function ConnexionPage({ searchParams }: PageProps<"/connexion">) {
  const { callbackUrl } = await searchParams;
  const { t } = await getI18n();
  const l = t.auth.login;
  return (
    <>
      <p data-auth-item className="eyebrow">
        {l.eyebrow}
      </p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.05] font-bold tracking-[-0.035em] text-ink sm:text-5xl">{l.title}</h1>
      <p data-auth-item className="mt-3 mb-8 text-muted-foreground">
        {l.lead}
      </p>
      <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} demoEnabled={demoLoginEnabled} googleEnabled={googleLoginEnabled} />
    </>
  );
}
