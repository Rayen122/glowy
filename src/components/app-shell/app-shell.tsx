import Link from "next/link";
import { CircleHelp, Search } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getI18n } from "@/i18n/server";
import { MobileNav } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string; icon: React.ReactNode; exact?: boolean; badge?: string };
export type NavGroup = { label?: string; items: NavItem[] };

function Nav({ groups, label }: { groups: NavGroup[]; label: string }) {
  return (
    <nav aria-label={label} className="space-y-6">
      {groups.map((g, i) => (
        <div key={g.label ?? i}>
          {g.label && <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href} exact={item.exact}>
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none font-bold text-primary-foreground">{item.badge}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Shell des espaces pro : sidebar + barre supérieure (dashboard salon, Super Admin). */
export async function AppShell({
  space,
  context,
  groups,
  user,
  action,
  children,
}: {
  space: string;
  context: React.ReactNode;
  groups: NavGroup[];
  user: { name: string; role: string; avatar?: string };
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  const s = t.shell;
  const sidebar = (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link href="/" aria-label={s.backToSite}>
          <Logo />
        </Link>
        <span className="rounded-full bg-blush px-2 py-0.5 text-[10px] font-bold tracking-wide text-plum-700 uppercase">{space}</span>
      </div>
      {context}
      <div className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1">
        <Nav groups={groups} label={s.mainNav} />
      </div>
      <div className="space-y-3">
        <Link href="/pro#faq" className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3 text-sm hover:bg-muted">
          <CircleHelp className="size-5 shrink-0 text-plum-600" aria-hidden />
          <span className="min-w-0">
            <span className="block font-medium">{s.help}</span>
            <span className="text-xs text-muted-foreground">{s.helpHint}</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 px-1">
          <Avatar className="size-9">
            {user.avatar && <AvatarImage src={user.avatar} alt="" />}
            <AvatarFallback className="bg-blush text-sm font-semibold text-plum-700">{user.name[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.role}</p>
          </div>
          <LogoutButton
            iconOnly
            label={t.header.logout}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[272px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh pt-[max(1.25rem,env(safe-area-inset-top))] border-e border-sidebar-border bg-sidebar px-4 py-5 lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
          <MobileNav label={s.openNav}>{sidebar}</MobileNav>
          <Link href="/" aria-label={s.backToSite} className="flex min-w-0 items-center gap-2 rounded-lg md:hidden">
            <Logo markOnly />
          </Link>
          <label className="relative hidden max-w-md flex-1 md:block">
            <span className="sr-only">{s.search}</span>
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              placeholder={s.searchPlaceholder}
              className="h-10 w-full rounded-full border border-border bg-card ps-10 pe-14 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
            <kbd className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
              ⌘K
            </kbd>
          </label>
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <NotificationBell />
            {action}
          </div>
          </div>
        </header>
        {/* Écrans plus étroits : recherche et navigation de la barre latérale, en onglets qui défilent */}
        <div className="border-b border-border bg-background lg:hidden">
          <label className="relative block px-3 pt-3 sm:px-6 md:hidden">
            <span className="sr-only">{s.search}</span>
            <Search className="pointer-events-none absolute start-6.5 top-[calc(50%+0.375rem)] size-4 -translate-y-1/2 text-muted-foreground sm:start-9.5" aria-hidden />
            <input
              type="search"
              placeholder={s.searchPlaceholder}
              className="h-10 w-full rounded-full border border-border bg-card ps-10 pe-4 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
            />
          </label>
          <nav aria-label={s.mainNav} className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2.5 sm:px-6">
            {groups
              .flatMap((g) => g.items)
              .map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  exact={item.exact}
                  className="h-9 shrink-0 gap-2 rounded-full border border-border bg-card px-3.5 whitespace-nowrap [&_svg]:size-4"
                  activeClassName="border-primary bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] leading-none font-bold text-white">{item.badge}</span>
                  )}
                </NavLink>
              ))}
          </nav>
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
