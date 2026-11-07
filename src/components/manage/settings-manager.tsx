"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/client";
import type { SalonSettings } from "@/modules/dashboard";
import { cn } from "@/lib/utils";
import { api, Field, FIELD, FormError, ImageUpload, PRIMARY_BUTTON, TEXTAREA, useAction } from "./kit";

type Kind = "GALLERY" | "BEFORE" | "AFTER";
/** Dimanche 18 octobre 2026 : sert seulement à nommer les jours de la semaine dans la langue choisie */
const SUNDAY = Date.UTC(2026, 9, 18);
const WEEK = [1, 2, 3, 4, 5, 6, 0];

function Section({ title, children, onSave, pending, error }: { title: string; children: React.ReactNode; onSave: () => void; pending: boolean; error: string | null }) {
  const { t } = useI18n();
  return (
    <section aria-label={title} className="space-y-4 rounded-3xl bg-card p-5 ring-1 ring-border sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
      <FormError message={error} />
      <div className="flex justify-end">
        <button type="button" onClick={onSave} disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? t.manage.common.saving : t.manage.common.save}
        </button>
      </div>
    </section>
  );
}

/** SAL-02 / SAL-07 : chaque section s'enregistre séparément (PATCH partiel) */
export function SettingsManager({ settings }: { settings: SalonSettings }) {
  const { t, df } = useI18n();
  const m = t.manage.settings;
  const save = (body: object) => api("/api/dashboard/settings", { method: "PATCH", body });

  // Profil
  const profileAction = useAction();
  const [profile, setProfile] = useState({ name: settings.name, description: settings.description ?? "", phone: settings.phone ?? "", address: settings.address, city: settings.city });
  const [amenities, setAmenities] = useState(settings.amenities);
  const [amenity, setAmenity] = useState("");

  // Photos
  const photoAction = useAction();
  const [cover, setCover] = useState<string | null>(settings.coverUrl);
  const [photos, setPhotos] = useState(settings.photos);
  const [adding, setAdding] = useState<string | null>(null);
  const [addingKind, setAddingKind] = useState<Kind>("GALLERY");

  // Horaires
  const hoursAction = useAction();
  const [hours, setHours] = useState(() =>
    WEEK.map((weekday) => {
      const h = settings.openingHours.find((o) => o.weekday === weekday);
      return { weekday, open: Boolean(h), opensAt: h?.opensAt ?? "09:00", closesAt: h?.closesAt ?? "19:00" };
    })
  );

  // Règles
  const rulesAction = useAction();
  const [rules, setRules] = useState({ cancellationHours: String(settings.cancellationHours), depositAmount: String(settings.depositAmount) });

  const dayName = (weekday: number) => df(new Date(SUNDAY + weekday * 86_400_000).toISOString().slice(0, 10), { weekday: "long" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/salons/${settings.slug}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-plum-700 hover:underline">
          <ExternalLink className="size-4" aria-hidden /> {m.viewPage}
        </Link>
        {settings.status === "PENDING" && <p className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-plum-800">{m.pendingNote}</p>}
      </div>

      <Section
        title={m.profile}
        pending={profileAction.pending}
        error={profileAction.error}
        onSave={() => profileAction.run(() => save({ ...profile, description: profile.description || null, phone: profile.phone || null, amenities }), t.manage.common.saved)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={m.name}>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} maxLength={80} className={FIELD} />
          </Field>
          <Field label={m.phone}>
            <input type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+216 71 000 000" className={FIELD} />
          </Field>
          <Field label={m.address}>
            <input value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} maxLength={160} className={FIELD} />
          </Field>
          <Field label={m.city}>
            <input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} maxLength={60} className={FIELD} />
          </Field>
          <Field label={m.descriptionField} className="sm:col-span-2">
            <textarea value={profile.description} onChange={(e) => setProfile({ ...profile, description: e.target.value })} maxLength={1000} rows={4} className={TEXTAREA} />
          </Field>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{m.amenities}</p>
          <ul className="flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 ps-3 pe-1 text-sm">
                {a}
                <button type="button" onClick={() => setAmenities(amenities.filter((x) => x !== a))} aria-label={m.removeAmenity.replace("{name}", a)} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-card sm:size-7">
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              value={amenity}
              onChange={(e) => setAmenity(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && amenity.trim()) {
                  e.preventDefault();
                  setAmenities([...new Set([...amenities, amenity.trim()])].slice(0, 12));
                  setAmenity("");
                }
              }}
              placeholder={m.amenityPlaceholder}
              aria-label={m.amenityPlaceholder}
              maxLength={40}
              className={cn(FIELD, "max-w-xs")}
            />
            <button
              type="button"
              disabled={!amenity.trim()}
              onClick={() => {
                setAmenities([...new Set([...amenities, amenity.trim()])].slice(0, 12));
                setAmenity("");
              }}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden /> {m.addAmenity}
            </button>
          </div>
        </div>
      </Section>

      <Section title={m.photos} pending={photoAction.pending} error={photoAction.error} onSave={() => photoAction.run(() => save({ coverUrl: cover, photos }), t.manage.common.saved)}>
        <ImageUpload label={m.cover} value={cover} onChange={setCover} aspect="aspect-[21/9]" className="max-w-xl" />
        <div className="space-y-3">
          <p className="text-sm font-medium">{m.gallery}</p>
          <p className="text-xs text-muted-foreground">{m.portfolioHint}</p>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.noPhotos}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <li key={`${p.url}-${i}`} className="space-y-1.5">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
                    <Image src={p.url} alt="" fill sizes="200px" className="object-cover" unoptimized={p.url.startsWith("/api/media/")} />
                    <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label={m.removePhoto.replace("{n}", String(i + 1))} className="absolute end-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-card/95 shadow-sm">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <select
                    value={p.kind}
                    onChange={(e) => setPhotos(photos.map((x, j) => (j === i ? { ...x, kind: e.target.value as Kind } : x)))}
                    aria-label={`${m.kind} ${i + 1}`}
                    className={cn(FIELD, "h-9")}
                  >
                    {(["GALLERY", "BEFORE", "AFTER"] as const).map((k) => (
                      <option key={k} value={k}>
                        {m.kinds[k]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <ImageUpload
              label={m.addPhoto}
              value={adding}
              onChange={(url) => {
                if (url) setPhotos([...photos, { url, kind: addingKind }]);
                setAdding(null);
              }}
              className="w-44"
            />
            <Field label={m.kind} className="w-40">
              <select value={addingKind} onChange={(e) => setAddingKind(e.target.value as Kind)} className={FIELD}>
                {(["GALLERY", "BEFORE", "AFTER"] as const).map((k) => (
                  <option key={k} value={k}>
                    {m.kinds[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title={m.hours}
        pending={hoursAction.pending}
        error={hoursAction.error}
        onSave={() => hoursAction.run(() => save({ openingHours: hours.filter((h) => h.open).map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt })) }), t.manage.common.saved)}
      >
        <ul className="divide-y divide-border">
          {hours.map((h, i) => (
            <li key={h.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
              <span className="w-28 font-medium first-letter:uppercase">{dayName(h.weekday)}</span>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={h.open} onCheckedChange={(v) => setHours(hours.map((x, j) => (j === i ? { ...x, open: v } : x)))} aria-label={dayName(h.weekday)} />
                {h.open ? m.open : m.closed}
              </label>
              {h.open && (
                <span className="flex items-center gap-2" dir="ltr">
                  <input type="time" step={900} value={h.opensAt} aria-label={m.opensAt} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, opensAt: e.target.value } : x)))} className={cn(FIELD, "w-32")} />
                  <span aria-hidden>–</span>
                  <input type="time" step={900} value={h.closesAt} aria-label={m.closesAt} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, closesAt: e.target.value } : x)))} className={cn(FIELD, "w-32")} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title={m.rules}
        pending={rulesAction.pending}
        error={rulesAction.error}
        onSave={() => rulesAction.run(() => save({ cancellationHours: Number(rules.cancellationHours), depositAmount: Number(rules.depositAmount) }), t.manage.common.saved)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.cancellationHours} hint={m.cancellationHint}>
            <input type="number" inputMode="numeric" min={0} max={72} value={rules.cancellationHours} onChange={(e) => setRules({ ...rules, cancellationHours: e.target.value })} className={FIELD} />
          </Field>
          <Field label={m.deposit} hint={m.depositHint}>
            <input type="number" inputMode="numeric" min={0} max={50} value={rules.depositAmount} onChange={(e) => setRules({ ...rules, depositAmount: e.target.value })} className={FIELD} />
          </Field>
        </div>
      </Section>
    </div>
  );
}


