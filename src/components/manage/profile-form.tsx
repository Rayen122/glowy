"use client";

import { useState } from "react";
import { CircleCheck, MailWarning } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, ImageUpload, PRIMARY_BUTTON, useAction } from "./kit";
import { ChangePasswordForm, ResendVerificationButton } from "./password-forms";

type Profile = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  birthDate: string | null;
  locale: "fr" | "ar" | "en";
  avatarUrl: string | null;
  emailVerified: boolean;
};

/** CLI-01 : profil modifiable, photo, vérification de l'e-mail, mot de passe */
export function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const m = t.manage.profile;
  const p = t.manage.password;
  const [draft, setDraft] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? "",
    city: profile.city ?? "",
    birthDate: profile.birthDate ?? "",
    locale: profile.locale,
  });
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const { run, pending, error } = useAction();
  const set = (key: keyof typeof draft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-5">
      <section aria-labelledby="personal-title" className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
        <h2 id="personal-title" className="text-lg font-semibold">
          {m.personal}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () =>
                api("/api/me", {
                  method: "PATCH",
                  body: { ...draft, phone: draft.phone || null, city: draft.city || null, birthDate: draft.birthDate || null, avatarUrl },
                }),
              t.manage.common.saved
            );
          }}
          className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]"
          noValidate
        >
          <ImageUpload label={m.photo} value={avatarUrl} onChange={setAvatarUrl} purpose="avatar" aspect="aspect-square" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={m.firstName}>
              <input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" maxLength={60} className={FIELD} />
            </Field>
            <Field label={m.lastName}>
              <input value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" maxLength={60} className={FIELD} />
            </Field>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium">{m.email}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{profile.email}</span>
                {profile.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <CircleCheck className="size-4" aria-hidden /> {m.verified}
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-warning">
                      <MailWarning className="size-4" aria-hidden /> {p.unverified}
                    </span>
                    <ResendVerificationButton />
                  </>
                )}
              </p>
            </div>
            <Field label={m.phone}>
              <input type="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="+216 20 000 000" className={FIELD} />
            </Field>
            <Field label={m.city}>
              <input value={draft.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" maxLength={60} className={FIELD} />
            </Field>
            <Field label={m.birthDate} hint={m.birthHint}>
              <input type="date" value={draft.birthDate} onChange={(e) => set("birthDate", e.target.value)} max={new Date().toISOString().slice(0, 10)} className={FIELD} />
            </Field>
            <Field label={m.language}>
              <select value={draft.locale} onChange={(e) => set("locale", e.target.value)} className={FIELD}>
                <option value="fr">Français</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">{m.completeBonus}</p>
            <div className="sm:col-span-2">
              <FormError message={error} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <button type="submit" disabled={pending} className={cn(PRIMARY_BUTTON)}>
                {pending ? t.manage.common.saving : t.manage.common.save}
              </button>
            </div>
          </div>
        </form>
      </section>
      <section aria-labelledby="security-title" className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
        <h2 id="security-title" className="text-lg font-semibold">
          {m.security}
        </h2>
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}
