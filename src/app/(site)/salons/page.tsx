import type { Metadata } from "next";
import { auth } from "@/auth";
import { SalonResults } from "@/components/salon/salon-results";
import { SearchBar } from "@/components/site/search-bar";
import { getI18n, getLocale } from "@/i18n/server";
import { CATEGORIES } from "@/lib/data";
import { searchSalons, withAiRanking } from "@/modules/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.salonsPage.metaTitle, description: t.salonsPage.metaDescription };
}

export default async function SalonsPage({ searchParams }: PageProps<"/salons">) {
  const { t, tc, f } = await getI18n();
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(params.q);
  const ville = one(params.ville);
  const categorie = one(params.categorie);
  const tri = one(params.tri);

  const category = CATEGORIES.find((c) => c.id === categorie);

  // « Autour de moi » (proche=1) : sans géolocalisation côté serveur, on ne filtre pas par ville
  const session = await auth();
  // IA P1 : ordre « Recommandé pour vous » choisi par le modèle d'IA pour une cliente connectée
  const salons = await withAiRanking(await searchSalons({ q: q || undefined, city: ville || undefined, category: category?.id }, session?.user.id), session?.user.id, await getLocale());

  const where = ville ? f(t.salonsPage.inCity, { city: tc(ville) }) : t.salonsPage.nearYou;
  const title = category
    ? f(t.salonsPage.titleCategory, { category: t.categories[category.id], where })
    : q
      ? f(t.salonsPage.titleQuery, { q, where })
      : f(t.salonsPage.titleAll, { where });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 pb-16 sm:px-6 lg:px-8">
      <SearchBar variant="compact" defaultQuery={q || (category ? t.categories[category.id] : "")} defaultCity={ville} />
      <div className="mt-6">
        <SalonResults salons={salons} title={title} initialSort={tri === "recommande" || !tri ? "recommande" : "note"} />
      </div>
    </div>
  );
}
