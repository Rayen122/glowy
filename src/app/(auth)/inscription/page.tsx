import type { Metadata } from "next";
import { googleLoginEnabled } from "@/auth";
import { SignupForm } from "@/components/site/auth-forms";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signup.metaTitle };
}

export default async function InscriptionPage({ searchParams }: PageProps<"/inscription">) {
  const { type } = await searchParams;
  const { t } = await getI18n();
  const s = t.auth.signup;
  return (
    <>
      <p data-auth-item className="eyebrow">
        {s.eyebrow}
      </p>
      <h1 className="mt-3 text-[2.25rem] leading-[1.05] font-bold tracking-[-0.035em] text-ink sm:text-5xl">{s.title}</h1>
      <p data-auth-item className="mt-3 mb-8 text-muted-foreground">
        {s.lead}
      </p>
      <SignupForm initialType={type === "salon" ? "salon" : "client"} googleEnabled={googleLoginEnabled} />
    </>
  );
}
