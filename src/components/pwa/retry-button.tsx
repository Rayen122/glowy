"use client";

import { RotateCw } from "lucide-react";

export function RetryButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-plum-800"
    >
      <RotateCw className="size-4" aria-hidden /> {label}
    </button>
  );
}
