import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { CampaignsManager, PointRulesTable } from "@/components/manage/loyalty-admin";
import { getI18n } from "@/i18n/server";
import { EDITABLE_REASONS, listCampaigns, listPointRules, loyaltyStats } from "@/modules/loyalty";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.loyaltyAdmin.title };
}

/** ADM-09 / FID-07 : barème des points, plafonds anti-fraude, campagnes « double points » */
export default async function AdminLoyaltyPage() {
  const [{ t, nf }, rules, campaigns, stats] = await Promise.all([getI18n(), listPointRules(), listCampaigns(), loyaltyStats()]);
  const m = t.manage.loyaltyAdmin;
  const tiles = [
    [m.earned, nf(stats.earned)],
    [m.redeemed, nf(stats.redeemed)],
    [m.expired, nf(stats.expired)],
    [m.members, nf(stats.members)],
  ];
  return (
    <div className="space-y-8">
      <ManageHeader title={m.title} description={m.description} />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-3xl bg-card p-4 ring-1 ring-border">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <CampaignsManager campaigns={campaigns} reasons={EDITABLE_REASONS} />
      <section aria-labelledby="rules-title" className="space-y-3">
        <div>
          <h2 id="rules-title" className="text-lg font-semibold">
            {m.rulesTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{m.rulesHint}</p>
        </div>
        <PointRulesTable rules={rules} />
      </section>
    </div>
  );
}
