"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Gift, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function CopyCode({ code }: { code: string }) {
  const { t, f } = useI18n();
  const l = t.loyalty;
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          /* presse-papiers indisponible */
        }
        setCopied(true);
        toast.success(l.codeCopied, { description: f(l.codeCopiedHint, { pts: f(t.common.plusPoints, { n: 50 }) }) });
        window.setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-dashed border-plum-300 bg-card ps-4 pe-2 font-mono text-base font-semibold tracking-wider text-plum-800 transition-colors hover:bg-plum-50"
      aria-label={f(l.copyAria, { code })}
    >
      <span dir="ltr">{code}</span>
      <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 font-sans text-xs font-semibold tracking-normal text-primary-foreground">
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? l.copied : l.copy}
      </span>
    </button>
  );
}

/** Échange de points (FID-04) : POST /api/me/loyalty/redeem, le code s'affiche dans la notification */
/** Échange de points : Glowy (catalogue global) ou points salon (endpoint="/api/me/salon-points/redeem", FID-06) */
export function RedeemButton({
  rewardId,
  label,
  cost,
  balance,
  endpoint = "/api/me/loyalty/redeem",
}: {
  rewardId: string;
  label: string;
  cost: number;
  balance: number;
  endpoint?: string;
}) {
  const { t, f, nf } = useI18n();
  const l = t.loyalty;
  const router = useRouter();
  const [redeemed, setRedeemed] = useState(false);
  const [pending, setPending] = useState(false);
  const missing = cost - balance;

  const redeem = async () => {
    setPending(true);
    try {
      const { code } = await api<{ code: string }>(endpoint, { method: "POST", body: { rewardId } });
      setRedeemed(true);
      toast.success(l.redeemedToast, { description: `${f(l.redeemedToastDesc, { label, cost: nf(cost) })} ${f(l.redeemCode, { code })}`, duration: 10_000 });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError && error.code === "INSUFFICIENT_POINTS" ? t.errors.insufficientPoints : t.errors.generic);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={missing > 0 || redeemed || pending}
      onClick={() => void redeem()}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors",
        redeemed ? "bg-success-soft text-success" : missing > 0 ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-plum-800"
      )}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : redeemed ? <Check className="size-4" aria-hidden /> : <Gift className="size-4" aria-hidden />}
      {redeemed ? l.redeemed : missing > 0 ? f(l.missing, { n: f(t.common.pointsCount, { n: nf(missing) }) }) : l.redeem}
    </button>
  );
}
