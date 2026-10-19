import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX } from "lucide-react";
import { AppError } from "@/core/domain/errors";
import { getI18n } from "@/i18n/server";
import { verifyEmail } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.password.verifyTitle };
}

/** AUTH-06 : ouverture du lien de confirmation reçu par e-mail */
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verifier-email">) {
  const { token } = await searchParams;
  const { t } = await getI18n();
  const m = t.manage.password;
  let ok = false;
  if (typeof token === "string" && token.length >= 20) {
    try {
      ok = (await verifyEmail(token)).verified;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }
  return (
    <>
      <h1 className="text-[2rem] leading-[1.05] font-bold tracking-[-0.035em] text-ink sm:text-4xl">{m.verifyTitle}</h1>
      <p className={`mt-6 flex items-start gap-2 font-medium ${ok ? "text-success" : "text-destructive"}`} role="status">
        {ok ? <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden /> : <CircleX className="mt-0.5 size-5 shrink-0" aria-hidden />}
        {ok ? m.verified : m.verifyFailed}
      </p>
      <Link href="/connexion" className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground hover:bg-plum-800">
        {m.toLogin}
      </Link>
    </>
  );
}
