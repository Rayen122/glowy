import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cake, Mail, Phone } from "lucide-react";
import { ClientNotes } from "@/components/manage/client-notes";
import { AppError } from "@/core/domain/errors";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { salonClientCard, staffSalon } from "@/modules/dashboard";
import { PlanUpsell } from "@/components/dashboard/plan-upsell";
import { planAccess } from "@/modules/subscription";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.crm.title };
}

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "text-muted-foreground",
  CONFIRMED: "text-success",
  PENDING: "text-success",
  IN_PROGRESS: "text-plum-700",
  CANCELLED: "text-destructive",
  NO_SHOW: "text-destructive",
};

/** SAL-08 : fiche cliente du salon */
export default async function ClientCardPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  const user = await requirePageUser("MANAGER", "EMPLOYEE", "ADMIN");
  const salon = await staffSalon(user);
  // Fonction réservée à un plan supérieur : présentation du plan à la place de la page
  if (!(await planAccess(salon.id)).features.includes("crm")) return <PlanUpsell feature="crm" canUpgrade={user.role !== "EMPLOYEE"} />;
  const card = await salonClientCard(salon.id, id).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  const { t, tc, nf, money, df } = await getI18n();
  const m = t.manage.crm;
  const statusLabel: Record<string, string> = { COMPLETED: t.account.status.termine, CONFIRMED: t.account.status.confirme, PENDING: t.account.status.en_attente, IN_PROGRESS: t.account.status.confirme, CANCELLED: t.account.status.annule, NO_SHOW: t.account.status.absent };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {m.back}
      </Link>
      <header>
        <h1 className="display text-3xl text-ink sm:text-4xl">{card.name}</h1>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-labelledby="contact-title" className="space-y-2 rounded-3xl bg-card p-5 ring-1 ring-border">
          <h2 id="contact-title" className="font-semibold">
            {m.contact}
          </h2>
          {card.phone && (
            <p className="flex items-center gap-2 text-sm" dir="ltr">
              <Phone className="size-4 text-muted-foreground" aria-hidden /> {card.phone}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm break-all">
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden /> {card.email}
          </p>
          {card.birthDate && (
            <p className="flex items-center gap-2 text-sm">
              <Cake className="size-4 text-muted-foreground" aria-hidden /> {m.birth} : {df(card.birthDate, { day: "numeric", month: "long" })}
            </p>
          )}
        </section>
        <section aria-labelledby="stats-title" className="rounded-3xl bg-card p-5 ring-1 ring-border lg:col-span-2">
          <h2 id="stats-title" className="mb-3 font-semibold">
            {m.stats}
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [m.colVisits, nf(card.visits)],
              [m.colSpent, money(card.spent)],
              [m.noShows, nf(card.noShows)],
              [m.cancellations, nf(card.cancellations)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {card.favoriteService && (
            <p className="mt-3 text-sm text-muted-foreground">
              {m.favorite} : <span className="font-semibold text-foreground">{tc(card.favoriteService)}</span>
            </p>
          )}
        </section>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="notes-title" className="rounded-3xl bg-card p-5 ring-1 ring-border">
          <h2 id="notes-title" className="font-semibold">
            {m.notes}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">{m.notesHint}</p>
          <ClientNotes clientId={card.id} notes={card.notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
        </section>
        <section aria-labelledby="history-title" className="rounded-3xl bg-card p-5 ring-1 ring-border">
          <h2 id="history-title" className="mb-3 font-semibold">
            {m.history}
          </h2>
          <ul className="divide-y divide-border">
            {card.history.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="w-28 shrink-0 text-muted-foreground">
                  {df(b.date, { day: "numeric", month: "short", year: "numeric" })} <span dir="ltr">{b.time}</span>
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {tc(b.service)} · {b.employee}
                </span>
                <span className={cn("text-xs font-semibold", STATUS_STYLE[b.status])}>{statusLabel[b.status]}</span>
                <span className="w-16 text-end font-semibold tabular-nums">{money(b.price)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
