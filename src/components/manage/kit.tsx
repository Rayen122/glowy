"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Kit commun des écrans de gestion (CRUD) : champs, erreurs, suppression confirmée, envoi de photo.
 * Les champs font 16 px sur téléphone (sinon iOS zoome au focus).
 */
export const FIELD =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:opacity-60 sm:text-sm";
export const TEXTAREA = cn(FIELD, "h-auto min-h-24 py-2.5");
export const PRIMARY_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800 disabled:opacity-60";
export const SECONDARY_BUTTON =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-muted disabled:opacity-60";
export const ICON_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50";

export const errorText = (error: unknown, fallback: string) => (error instanceof ApiError ? (error.details?.[0]?.message ?? error.message) : fallback);

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm font-medium", className)}>
      <span>{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm font-medium text-destructive">
      {message}
    </p>
  );
}

/** Appel d'API d'un formulaire : état d'envoi, message d'erreur lisible, rafraîchissement de la page serveur */
export function useAction() {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(call: () => Promise<T>, success?: string): Promise<T | null> {
    setPending(true);
    setError(null);
    try {
      const result = await call();
      if (success) toast.success(success);
      router.refresh();
      return result;
    } catch (e) {
      const message = errorText(e, t.errors.generic);
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, setError };
}

/** Suppression en deux temps : un premier clic arme le bouton, le second confirme */
export function ConfirmDelete({ label, onConfirm, compact = false }: { label: string; onConfirm: () => Promise<unknown>; compact?: boolean }) {
  const { t } = useI18n();
  const m = t.manage.common;
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} aria-label={`${m.delete} — ${label}`} className={compact ? ICON_BUTTON : cn(SECONDARY_BUTTON, "text-destructive")}>
        <Trash2 className="size-4" aria-hidden />
        {!compact && m.delete}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onConfirm();
          } finally {
            setPending(false);
            setArmed(false);
          }
        }}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-destructive px-3.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} {m.confirmDelete}
      </button>
      <button type="button" onClick={() => setArmed(false)} aria-label={m.cancel} className={ICON_BUTTON}>
        <X className="size-4" aria-hidden />
      </button>
    </span>
  );
}

/** Envoi d'une photo vers /api/media ; renvoie son URL au formulaire parent */
export function ImageUpload({
  value,
  onChange,
  purpose = "salon",
  label,
  className,
  aspect = "aspect-[4/3]",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  purpose?: "salon" | "review" | "avatar" | "document" | "analysis";
  label?: string;
  className?: string;
  aspect?: string;
}) {
  const { t } = useI18n();
  const m = t.manage.common;
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      const response = await fetch("/api/media", { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new ApiError(response.status, json?.error?.code ?? "UPLOAD", json?.error?.message ?? m.uploadFailed);
      onChange(json.data.url as string);
    } catch (e) {
      toast.error(errorText(e, m.uploadFailed));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      {value ? (
        <div className={cn("relative overflow-hidden rounded-2xl bg-muted ring-1 ring-border", aspect)}>
          <Image src={value} alt="" fill sizes="(min-width: 640px) 320px, 100vw" className="object-cover" unoptimized={value.startsWith("/api/media/")} />
          <div className="absolute end-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => input.current?.click()} className="inline-flex h-9 items-center rounded-full bg-card/95 px-3 text-xs font-semibold shadow-sm ring-1 ring-border">
              {m.replacePhoto}
            </button>
            <button type="button" onClick={() => onChange(null)} aria-label={m.removePhoto} className="inline-flex size-9 items-center justify-center rounded-full bg-card/95 shadow-sm ring-1 ring-border">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading}
          className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-sm font-medium text-muted-foreground hover:bg-muted", aspect)}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
          {uploading ? m.uploading : m.uploadPhoto}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={purpose === "document" ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

/** En-tête commun des pages de gestion */
export function ManageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 data-animate="split" className="display text-3xl text-ink sm:text-4xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export { api };

/** Impression de la page (le navigateur propose « Enregistrer en PDF ») — le menu et l'en-tête sont masqués à l'impression */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={cn(SECONDARY_BUTTON, "h-10 px-4 print:hidden")}>
      {label}
    </button>
  );
}
