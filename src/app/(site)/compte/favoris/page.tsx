import type { Metadata } from "next";
import { SalonCard } from "@/components/salon/salon-card";
import { getI18n } from "@/i18n/server";
import { favoriteSalons } from "@/modules/catalog";
import { requirePageUser } from "@/infrastructure/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.favorites.title };
}

export default async function FavorisPage() {
  const user = await requirePageUser();
  const [{ t, f }, salons] = await Promise.all([getI18n(), favoriteSalons(user.id)]);
  return (
    <div>
      <h1 data-animate="split" className="display text-4xl text-ink">
        {t.account.favorites.title}
      </h1>
      <p className="mt-2 text-muted-foreground">{f(t.account.favorites.subtitle, { n: salons.length })}</p>
      <div data-animate="stagger" data-stagger="0.1" className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {salons.map((s) => (
          <SalonCard key={s.slug} salon={s} />
        ))}
      </div>
    </div>
  );
}
