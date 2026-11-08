import { NotFoundContent } from "@/components/site/not-found-content";

/** Adresse inconnue : page 404 traduite (et non la page anglaise par défaut) */
export default function NotFound() {
  return (
    <main>
      <NotFoundContent standalone />
    </main>
  );
}
