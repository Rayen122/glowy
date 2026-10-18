"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";

export function ShareButton({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href;
        try {
          if (navigator.share) await navigator.share({ title, url });
          else {
            await navigator.clipboard.writeText(url);
            toast.success(t.share.copied, { description: t.share.copiedHint });
          }
        } catch {
          /* partage annulé */
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted"
    >
      <Share2 className="size-4" aria-hidden />
      {t.share.label}
    </button>
  );
}
