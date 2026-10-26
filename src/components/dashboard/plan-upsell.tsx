import Link from "next/link";
import { Lock } from "lucide-react";
import type { PlanId } from "@/core/domain/enums";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { minimumPlanFor, type PlanFeature } from "@/modules/subscription";

/**
 * Fonction réservée à un plan supérieur (page /pro) : explication et lien vers l'abonnement pour le gérant,
 * à la place de la fonction. Le serveur refuse de toute façon l'accès (PLAN_REQUIRED).
 */
export async function PlanUpsell({ feature, canUpgrade, compact = false, className }: { feature: PlanFeature; canUpgrade: boolean; compact?: boolean; className?: string }) {
  const { t, f } = await getI18n();
  const p = t.dashboard.planGate;
  const plan: PlanId = minimumPlanFor(feature);
  const name = t.admin.plans[plan];
  return (
    <section className={cn("rounded-3xl border border-dashed border-plum-200 bg-blush/40 text-center", compact ? "p-5" : "p-8 sm:p-10", className)}>
      <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-card text-plum-700 ring-1 ring-plum-200">
        <Lock className="size-5" aria-hidden />
      </span>
      {compact ? <h2 className="mt-3 font-semibold">{f(p.title, { plan: name })}</h2> : <h1 className="mt-3 text-xl font-semibold">{f(p.title, { plan: name })}</h1>}
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{f(p.text, { feature: p.features[feature], plan: name })}</p>
      {canUpgrade ? (
        <Link href="/dashboard/abonnement" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-plum-800">
          {f(p.cta, { plan: name })}
        </Link>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{f(p.askManager, { plan: name })}</p>
      )}
    </section>
  );
}
