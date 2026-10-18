import Link from "next/link";
import { ArrowLeft, Hammer, UserRound } from "lucide-react";
import { getI18n } from "@/i18n/server";
import type { ModuleDef, Priority } from "@/lib/modules";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE: Record<Priority, string> = {
  must: "bg-success-soft text-success",
  should: "bg-warning-soft text-warning",
  bonus: "bg-muted text-muted-foreground",
};

/** Page « module à construire » : rappelle le périmètre du cahier des charges à l'équipe. */
export async function ModulePlaceholder({
  module,
  title,
  description,
  backHref,
}: {
  module: ModuleDef;
  title: string;
  description: string;
  backHref: string;
}) {
  const { t, f, rich } = await getI18n();
  const m = t.modules;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {m.back}
      </Link>
      <h1 data-animate="split" className="display mt-4 text-3xl text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">{description}</p>

      <div data-animate="pop" className="mt-8 rounded-3xl border border-dashed border-plum-300 bg-card p-6 text-center sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blush text-plum-700">
          <Hammer className="size-6" aria-hidden />
        </span>
        <p className="mt-4 font-semibold">{m.building}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {rich(m.buildingHint, {
            file: (
              <code key="file" dir="ltr" className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                design-system/MASTER.md
              </code>
            ),
          })}
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium">
          <UserRound className="size-3.5" aria-hidden /> {f(m.owner, { names: module.owners.map((n) => f(m.person, { n })).join(" · ") })}
        </p>
      </div>

      <h2 className="mt-10 text-lg font-semibold">{m.requirementsTitle}</h2>
      <div data-animate="fade-up" className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-3 text-start font-medium sm:px-4">
                {m.colRef}
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium sm:px-4">
                {m.colRequirement}
              </th>
              <th scope="col" className="px-3 py-3 text-start font-medium sm:px-4">
                {m.colPriority}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {module.requirements.map((r) => (
              <tr key={r.ref}>
                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap sm:px-4" dir="ltr">
                  {r.ref}
                </td>
                <td className="px-3 py-3 sm:px-4">{m.requirements[r.ref]}</td>
                <td className="px-3 py-3 sm:px-4">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", PRIORITY_STYLE[r.priority])}>
                    {m.priority[r.priority]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
