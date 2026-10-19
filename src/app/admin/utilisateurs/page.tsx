import type { Metadata } from "next";
import Link from "next/link";
import { Lock, MailWarning, Search } from "lucide-react";
import { Pager, UserActions } from "@/components/manage/admin-actions";
import { ManageHeader } from "@/components/manage/kit";
import { ROLES, type Role } from "@/core/domain/actor";
import { USER_STATUSES, type UserStatus } from "@/core/domain/enums";
import { utcToTunis } from "@/core/domain/time";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { listUsersForAdmin } from "@/modules/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.admin.usersTitle };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ADM-04 : comptes de la plateforme */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const me = await requirePageUser("ADMIN");
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80);
  const roleParam = one(sp.role);
  const role = (ROLES as readonly string[]).includes(roleParam ?? "") ? (roleParam as Role) : undefined;
  const statusParam = one(sp.statut);
  const status = (USER_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as UserStatus) : undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const [{ t, nf, df }, list] = await Promise.all([getI18n(), listUsersForAdmin({ q, role, status, page })]);
  const m = t.manage.admin;
  const total = Object.values(list.counts).reduce((a, n) => a + (n ?? 0), 0);
  const tab = (value?: Role) => `?${new URLSearchParams(Object.entries({ q, role: value, statut: status }).filter((e): e is [string, string] => Boolean(e[1]))).toString()}`;

  return (
    <div className="space-y-5">
      <ManageHeader title={m.usersTitle} description={m.usersDescription} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label={m.colRole}>
          {[undefined, ...ROLES].map((r) => (
            <Link
              key={r ?? "all"}
              href={tab(r)}
              aria-current={r === role ? "page" : undefined}
              className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1", r === role ? "bg-ink text-white ring-ink" : "bg-card ring-border hover:bg-muted")}
            >
              {r ? m.roles[r] : t.manage.common.all}
              <span className="tabular-nums opacity-70">{nf(r ? (list.counts[r] ?? 0) : total)}</span>
            </Link>
          ))}
        </nav>
        <form className="flex w-full flex-wrap gap-2 sm:w-auto" role="search">
          {role && <input type="hidden" name="role" value={role} />}
          <select name="statut" defaultValue={status ?? ""} aria-label={m.colStatus} className="h-10 rounded-full border border-border bg-card px-3 text-base sm:text-sm">
            <option value="">{t.manage.common.all}</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {m.userStatuses[s]}
              </option>
            ))}
          </select>
          <span className="relative min-w-0 flex-1 sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input name="q" defaultValue={q} placeholder={m.searchPlaceholder} aria-label={t.manage.common.search} className="h-10 w-full rounded-full border border-border bg-card ps-9 pe-4 text-base sm:text-sm" />
          </span>
        </form>
      </div>

      <div className="no-scrollbar overflow-x-auto rounded-3xl bg-card ring-1 ring-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              {[m.colName, m.colRole, m.colPoints, m.colStatus, m.colCreated, t.manage.common.actions].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {m.noUsers}
                </td>
              </tr>
            )}
            {list.rows.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.name || "—"}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {u.email}
                    {!u.emailVerified && <MailWarning className="size-3.5 text-warning" aria-label={m.unverified} />}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {m.roles[u.role as Role]}
                  {u.salon && <p className="text-xs text-muted-foreground">{u.salon}</p>}
                </td>
                <td className="px-4 py-3 tabular-nums">{u.role === "CLIENT" ? nf(u.points) : "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", u.status === "ACTIVE" ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>{m.userStatuses[u.status as UserStatus]}</span>
                  {u.locked && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                      <Lock className="size-3" aria-hidden /> {m.locked}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{df(utcToTunis(u.createdAt).date, { day: "numeric", month: "short", year: "numeric" })}</td>
                <td className="px-4 py-3">
                  <UserActions id={u.id} status={u.status} isSelf={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.page} pages={list.pages} params={{ q, role, statut: status }} />
    </div>
  );
}
