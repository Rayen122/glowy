import type { Metadata } from "next";
import { Award, Clock3, Compass, Crown, Gift, MessageSquareText, ShieldCheck, Timer, Users } from "lucide-react";
import { CopyCode, RedeemButton } from "@/components/loyalty/loyalty-ui";
import { TierProgress } from "@/components/loyalty/tier-progress";
import { getI18n } from "@/i18n/server";
import { EARN_RULES, TIERS, tierFor } from "@/lib/data";
import { getAccountSummary } from "@/modules/account";
import { getLoyaltyPage, HISTORY_KEY } from "@/modules/loyalty";
import { requirePageUser } from "@/infrastructure/session";
import { utcToTunis } from "@/core/domain/time";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.loyalty.title };
}

const BADGE_ICON: Record<string, typeof Award> = {
  explorateur: Compass,
  ponctuel: Timer,
  fidele: Award,
  critique: MessageSquareText,
  ambassadeur: Users,
};

export default async function FidelitePage() {
  const user = await requirePageUser();
  const [{ t, tc, f, nf, df }, { account, history, rewards, badges }, { profile }] = await Promise.all([
    getI18n(),
    getLoyaltyPage(user.id),
    getAccountSummary(user.id),
  ]);
  const l = t.account.loyalty;
  const tier = tierFor(account.lifetime);
  const pts = (n: number) => f(t.common.pointsCount, { n: nf(n) });

  return (
    <div className="space-y-10">
      <header>
        <h1 data-animate="split" className="display text-4xl text-ink">
          {l.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{l.subtitle}</p>
      </header>

      {/* Solde */}
      <section data-animate="stagger" data-stagger="0.12" className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" aria-label={l.balanceAria}>
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#3a1532_0%,#6b2a5c_60%,#8e3b7e_100%)] p-6 text-white sm:p-7">
          <div className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full border border-white/10" aria-hidden />
          <p className="text-sm text-white/75">{l.available}</p>
          <p className="mt-1 text-5xl font-semibold tracking-tight sm:text-6xl">
            <span data-animate="count">{nf(account.balance)}</span>
            <span className="ms-2 text-xl text-white/60">{t.common.pts}</span>
          </p>
          <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-sm text-white/75">
            <Crown className="size-4 text-[#e9c979]" aria-hidden /> {f(l.levelLine, { tier: tc(tier.label), total: pts(account.lifetime) })}
          </p>
          <TierProgress lifetime={account.lifetime} invert className="mt-8" />
          <p className="mt-6 flex items-start gap-2 text-xs text-white/60">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {l.expiry}
          </p>
        </div>

        <div className="rounded-3xl bg-card p-6 ring-1 ring-border">
          <h2 className="font-semibold">{l.perksTitle}</h2>
          <ol className="mt-4 space-y-3">
            {TIERS.map((x) => (
              <li key={x.id} className={cn("rounded-2xl p-3.5", x.id === tier.id ? "bg-gold-soft ring-1 ring-[#e6d3a6]" : "bg-muted/60")}>
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  {tc(x.label)}
                  <span className="text-xs font-normal text-muted-foreground" dir="ltr">
                    {x.max ? `${nf(x.min)} – ${pts(x.max)}` : f(t.home.loyalty.tierMin, { n: nf(x.min) })}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{x.perks.map(tc).join(" · ")}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Récompenses */}
      <section aria-labelledby="rewards-title">
        <h2 id="rewards-title" className="text-lg font-semibold">
          {l.rewardsTitle}
        </h2>
        <ul data-animate="stagger" data-stagger="0.07" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rewards.map((r) => (
            <li key={r.id} className="flex flex-col rounded-3xl bg-card p-5 ring-1 ring-border">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-gold-soft text-gold">
                <Gift className="size-5" aria-hidden />
              </span>
              <p className="mt-4 flex-1 font-medium">{tc(r.label)}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {nf(r.cost)} <span className="text-sm font-normal text-muted-foreground">{t.common.pts}</span>
              </p>
              <div className="mt-4">
                <RedeemButton rewardId={r.id} label={tc(r.label)} cost={r.cost} balance={account.balance} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div data-animate="stagger" data-stagger="0.12" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Gagner */}
        <section aria-labelledby="earn-title" className="rounded-3xl bg-card p-6 ring-1 ring-border">
          <h2 id="earn-title" className="font-semibold">
            {l.earnTitle}
          </h2>
          <table className="mt-4 w-full text-sm">
            <caption className="sr-only">{l.earnCaption}</caption>
            <tbody className="divide-y divide-border">
              {EARN_RULES.map((r) => (
                <tr key={r.action}>
                  <th scope="row" className="py-2.5 pe-3 text-start font-medium">
                    {tc(r.action)}
                    <span className="block text-xs font-normal text-muted-foreground">{tc(r.note)}</span>
                  </th>
                  <td className="py-2.5 text-end font-semibold text-gold tabular-nums" dir="ltr">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-plum-600" aria-hidden />
            {l.antiFraud}
          </p>
        </section>

        <div className="space-y-4">
          {/* Parrainage */}
          <section id="parrainage" aria-labelledby="ref-title" className="scroll-mt-24 rounded-3xl bg-blush p-6 ring-1 ring-plum-200">
            <h2 id="ref-title" className="font-semibold text-plum-900">
              {f(l.referTitle, { pts: f(t.common.plusPoints, { n: 50 }) })}
            </h2>
            <p className="mt-1 text-sm text-plum-800">{l.referText}</p>
            <div className="mt-4">
              <CopyCode code={profile.referralCode} />
            </div>
          </section>

          {/* Historique */}
          <section aria-labelledby="history-title" className="rounded-3xl bg-card p-6 ring-1 ring-border">
            <h2 id="history-title" className="font-semibold">
              {l.historyTitle}
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{f(l.history[HISTORY_KEY[h.reason] as keyof typeof l.history], { who: tc(h.label ?? "") }).replace(/ · $/, "")}</span>
                    <span className="text-xs text-muted-foreground">{df(utcToTunis(h.createdAt).date, { day: "numeric", month: "short" })}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", h.points > 0 ? "text-success" : "text-muted-foreground")} dir="ltr">
                    {h.points > 0 ? `+${nf(h.points)}` : `−${nf(Math.abs(h.points))}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Badges */}
      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="text-lg font-semibold">
          {l.badgesTitle}
        </h2>
        <ul data-animate="stagger" data-stagger="0.07" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.id] ?? Award;
            const earned = b.progress >= b.target;
            return (
              <li key={b.id} className={cn("rounded-3xl p-4 text-center ring-1 sm:p-5", earned ? "bg-card ring-plum-200" : "bg-muted/50 ring-border")}>
                <span
                  className={cn(
                    "mx-auto flex size-14 items-center justify-center rounded-full",
                    earned ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border"
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold">{tc(b.label)}</p>
                <p className="text-xs text-muted-foreground">{tc(b.goal)}</p>
                <p className={cn("mt-2 text-xs font-semibold", earned ? "text-success" : "text-muted-foreground")} dir={earned ? undefined : "ltr"}>
                  {earned ? l.earned : `${nf(b.progress)} / ${nf(b.target)}`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
