import type { Metadata } from "next";
import Link from "next/link";
import { Pager } from "@/components/manage/admin-actions";
import { ManageHeader } from "@/components/manage/kit";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { auditTrail } from "@/modules/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.auditTitle };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ADM-07 : journal complet des actions sensibles */
export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const kind = one(sp.type)?.replace(/[^a-z]/gi, "").slice(0, 20) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ t, f, ago }, trail] = await Promise.all([getI18n(), auditTrail({ kind, page })]);
  const m = t.manage.admin;
  const a = t.admin.audit;
  const actions = a.actions as Record<string, string>;

  return (
    <div className="space-y-5">
      <ManageHeader title={m.auditTitle} description={m.auditDescription} />
      <nav className="flex flex-wrap gap-2" aria-label={m.kinds}>
        {[undefined, ...trail.kinds].map((k) => (
          <Link
            key={k ?? "all"}
            href={k ? `?type=${k}` : "?"}
            aria-current={k === kind ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1", k === kind ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
          >
            {k ?? t.manage.common.all}
          </Link>
        ))}
      </nav>
      <ol className="divide-y divide-border rounded-3xl bg-card ring-1 ring-border">
        {trail.rows.length === 0 && <li className="p-10 text-center text-sm text-muted-foreground">{m.noAudit}</li>}
        {trail.rows.map((e) => {
          const target = String((e.meta?.name as string | undefined) ?? (e.meta?.email as string | undefined) ?? e.targetId ?? "");
          return (
            <li key={e.id} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">{ago(e.minutesAgo)}</span>
              <p className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{e.actor ? e.actor.name : a.system}</span> {f(actions[e.action] ?? e.action, { target })}
                {typeof e.meta?.reason === "string" && e.meta.reason && <span className="block text-xs text-muted-foreground">« {e.meta.reason} »</span>}
              </p>
              <code className="text-xs text-muted-foreground" dir="ltr">
                {e.action}
              </code>
            </li>
          );
        })}
      </ol>
      <Pager page={trail.page} pages={trail.pages} params={{ type: kind }} />
    </div>
  );
}
