import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getI18n } from "@/i18n/server";
import { CITIES } from "@/lib/data";

export async function SiteFooter() {
  const { t, tc } = await getI18n();
  const f = t.footer;

  const columns = [
    {
      title: f.clients,
      links: [
        { href: "/salons", label: f.findSalon },
        { href: "/analyse-beaute", label: f.analysis },
        { href: "/compte/fidelite", label: f.loyalty },
        { href: "/inscription", label: f.signup },
      ],
    },
    {
      title: f.pros,
      links: [
        { href: "/pro", label: f.forSalons },
        { href: "/pro#tarifs", label: f.pricing },
        { href: "/inscription?type=salon", label: f.registerSalon },
      ],
    },
    {
      title: f.demo,
      links: [
        { href: "/compte", label: f.clientSpace },
        { href: "/dashboard", label: f.salonDashboard },
        { href: "/admin", label: f.superAdmin },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-sand/60">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-9 py-12 sm:py-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10">
        <div className="col-span-2 max-w-xs space-y-4 md:col-span-1">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">{f.tagline}</p>
          <div className="flex flex-wrap gap-x-3 text-sm text-muted-foreground sm:gap-y-1">
            {CITIES.slice(0, 6).map((c) => (
              <Link key={c.name} href={`/salons?ville=${encodeURIComponent(c.name)}`} className="inline-flex min-h-10 items-center hover:text-foreground hover:underline sm:min-h-0">
                {tc(c.name)}
              </Link>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="text-sm font-semibold text-foreground">{col.title}</h2>
            <ul className="mt-2 sm:mt-4 sm:space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-10 items-center text-sm text-muted-foreground transition-colors hover:text-foreground sm:min-h-0">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{f.legal}</p>
          <p>{f.demoNote}</p>
        </div>
      </div>
    </footer>
  );
}
