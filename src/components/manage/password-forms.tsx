"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, KeyRound, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, PRIMARY_BUTTON, SECONDARY_BUTTON, useAction } from "./kit";

/** AUTH-05 : demande d'un lien de réinitialisation */
export function ForgotPasswordForm() {
  const { t } = useI18n();
  const m = t.manage.password;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ simulated: boolean } | null>(null);
  const { run, pending, error } = useAction();

  if (sent) {
    return (
      <div className="space-y-4" role="status">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <MailCheck className="size-5 text-plum-600" aria-hidden /> {m.sentTitle}
        </p>
        <p className="text-muted-foreground">{m.sentText}</p>
        {sent.simulated && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{m.demoHint}</p>}
        <Link href="/connexion" className={cn(SECONDARY_BUTTON, "w-full")}>
          {m.toLogin}
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await run(() => api<{ simulated: boolean }>("/api/auth/password/forgot", { method: "POST", body: { email } }));
        if (result) setSent(result);
      }}
      className="space-y-4"
      noValidate
    >
      <Field label={m.email}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={cn(FIELD, "h-12")} />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={pending || !email.includes("@")} className={cn(PRIMARY_BUTTON, "h-12 w-full")}>
        {m.send}
      </button>
    </form>
  );
}

/** AUTH-05 : nouveau mot de passe à partir du lien reçu par e-mail */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const { t } = useI18n();
  const m = t.manage.password;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const { run, pending, error, setError } = useAction();

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">{m.missingToken}</p>
        <Link href="/mot-de-passe-oublie" className={cn(PRIMARY_BUTTON, "w-full")}>
          {m.newLink}
        </Link>
      </div>
    );
  }
  if (done) {
    return (
      <div className="space-y-4" role="status">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CircleCheck className="size-5" aria-hidden /> {m.resetDone}
        </p>
        <Link href="/connexion" className={cn(PRIMARY_BUTTON, "w-full")}>
          {m.toLogin}
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError(m.mismatch);
        if (await run(() => api("/api/auth/password/reset", { method: "POST", body: { token, password } }))) setDone(true);
      }}
      className="space-y-4"
      noValidate
    >
      <Field label={m.newPassword}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required className={cn(FIELD, "h-12")} />
      </Field>
      <Field label={m.confirm}>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} required className={cn(FIELD, "h-12")} />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={pending || password.length < 8 || !confirm} className={cn(PRIMARY_BUTTON, "h-12 w-full")}>
        {m.resetSubmit}
      </button>
      <Link href="/mot-de-passe-oublie" className="block text-center text-sm font-semibold text-plum-700 hover:underline">
        {m.newLink}
      </Link>
    </form>
  );
}

/** Changement de mot de passe d'un utilisateur connecté */
export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { t } = useI18n();
  const m = t.manage.password;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => api("/api/me/password", { method: "PATCH", body: { current, next } }), m.changed)) {
          setCurrent("");
          setNext("");
          onDone?.();
        }
      }}
      className="space-y-3"
      noValidate
    >
      <Field label={m.current}>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required className={FIELD} />
      </Field>
      <Field label={m.newPassword}>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required className={FIELD} />
      </Field>
      <FormError message={error} />
      <button type="submit" disabled={pending || !current || next.length < 8} className={PRIMARY_BUTTON}>
        {m.changeTitle}
      </button>
    </form>
  );
}

/** AUTH-06 : renvoyer le lien de confirmation de l'adresse e-mail */
export function ResendVerificationButton() {
  const { t } = useI18n();
  const m = t.manage.password;
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const { simulated } = await api<{ simulated: boolean }>("/api/me/verify-email", { method: "POST" });
          toast.success(m.verificationSent, { description: simulated ? m.demoHint : undefined });
        } catch {
          toast.error(t.errors.generic);
        } finally {
          setPending(false);
        }
      }}
      className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60"
    >
      {m.resendVerification}
    </button>
  );
}

/** Accès au changement de mot de passe depuis le dashboard (équipe des salons, Super Admin) */
export function ChangePasswordButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const m = t.manage.password;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={m.changeTitle} title={m.changeTitle} className={className}>
        <KeyRound className="size-[18px]" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.changeTitle}</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
