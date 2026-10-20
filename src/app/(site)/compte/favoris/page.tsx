import type { Metadata } from "next";
import Link from "next/link";
import { FavoriteButton } from "@/components/salon/favorite-button";
import { Rating } from "@/components/salon/badges";
import { SalonCard } from "@/components/salon/salon-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getI18n } from "@/i18n/server";
import { favoriteEmployees, favoriteSalons } from "@/modules/catalog";
import { requirePageUser } from "@/infrastructure/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.favorites.title };
}

/** CLI-03 : salons et professionnels favoris */
export default async function FavorisPage() {
  const user = await requirePageUser();
  const [{ t, f, tc }, salons, pros] = await Promise.all([getI18n(), favoriteSalons(user.id), favoriteEmployees(user.id)]);
  const fav = t.account.favorites;
  return (
    <div className="space-y-10">
      <header>
        <h1 data-animate="split" className="display text-4xl text-ink">
          {fav.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{f(fav.subtitle, { n: salons.length })}</p>
      </header>

      <section aria-labelledby="fav-pros">
        <h2 id="fav-pros" className="text-lg font-semibold">
          {fav.prosTitle}
        </h2>
        {pros.length === 0 ? (
          <p className="mt-3 rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{fav.prosEmpty}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {pros.map((p) => (
              <li key={p.id} className="relative flex items-center gap-4 rounded-3xl bg-card p-4 ring-1 ring-border">
                <Avatar className="size-14">
                  {p.avatar && <AvatarImage src={p.avatar} alt="" />}
                  <AvatarFallback className="bg-blush text-lg font-semibold text-plum-700">{p.name[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tc(p.title)} · {p.salon.name}, {tc(p.salon.city)}
                  </p>
                  <Rating value={p.rating} className="mt-1 text-xs" />
                  {p.active ? (
                    <Link href={`/salons/${p.salon.slug}/reserver?pro=${p.key}`} className="mt-2 inline-flex text-sm font-semibold text-plum-700 hover:underline">
                      {f(fav.bookWith, { name: p.name })}
                    </Link>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">{fav.unavailable}</p>
                  )}
                </div>
                <FavoriteButton salonName={p.name} salonSlug={p.salon.slug} employeeKey={p.key} initial variant="outline" className="size-9 self-start" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fav-salons">
        <h2 id="fav-salons" className="text-lg font-semibold">
          {fav.salonsTitle}
        </h2>
        <div data-animate="stagger" data-stagger="0.1" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {salons.map((s) => (
            <SalonCard key={s.slug} salon={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
