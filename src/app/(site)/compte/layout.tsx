import type { Metadata } from "next";
import { CalendarDays, Gift, Heart, LayoutGrid, ScanFace, UserRound } from "lucide-react";
import { NavLink } from "@/components/app-shell/nav-link";
import { LogoutButton } from "@/components/auth/logout-button";
import { TierBadge } from "@/components/loyalty/tier-progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getI18n } from "@/i18n/server";
import { getAccountSummary } from "@/modules/account";
import { requirePageUser } from "@/infrastructure/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: { default: t.account.metaTitle, template: `%s · ${t.account.metaTitle} · Glowy` } };
}

export default async function CompteLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  const [{ t, f, nf }, { profile, account }] = await Promise.all([getI18n(), getAccountSummary(user.id)]);
  const n = t.account.nav;
  const nav = [
    { href: "/compte", label: n.overview, icon: <LayoutGrid />, exact: true },
    { href: "/compte/rendez-vous", label: n.bookings, icon: <CalendarDays /> },
    { href: "/compte/fidelite", label: n.loyalty, icon: <Gift /> },
    { href: "/compte/favoris", label: n.favorites, icon: <Heart /> },
    { href: "/analyse-beaute", label: n.analysis, icon: <ScanFace /> },
    { href: "/compte/profil", label: t.manage.profile.nav, icon: <UserRound /> },
  ];

  return (
    <div className="container-page grid grid-cols-1 gap-6 py-6 sm:gap-8 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-12 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center gap-3 rounded-3xl bg-card p-4 ring-1 ring-border">
          <Avatar className="size-12">
            {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
            <AvatarFallback className="bg-blush font-semibold text-plum-700">
              {profile.firstName.charAt(0)}
              {profile.lastName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {profile.firstName} {profile.lastName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <TierBadge points={account.lifetime} />
              <span className="text-xs font-semibold text-gold">{f(t.common.pointsCount, { n: nf(account.balance) })}</span>
            </div>
          </div>
        </div>
        <nav aria-label={n.aria} className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:px-0">
          {nav.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              exact={item.exact}
              className="shrink-0 whitespace-nowrap"
              activeClassName="bg-card text-foreground font-semibold ring-1 ring-border"
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
          <LogoutButton
            label={n.logout}
            className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:mt-4"
          />
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
