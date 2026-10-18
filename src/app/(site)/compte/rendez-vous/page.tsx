import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarX, CircleCheck, Clock, Hourglass, Repeat, UserX } from "lucide-react";
import { CancelBookingButton, ReviewDialog } from "@/components/account/booking-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BookingStatus } from "@/core/domain/enums";
import type { I18n } from "@/i18n/format";
import { getI18n } from "@/i18n/server";
import { getAccountSummary, type AccountBooking } from "@/modules/account";
import { requirePageUser } from "@/infrastructure/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.bookings.title };
}

/** Statut en base → libellé et style (account.status) */
const STATUS_UI: Record<BookingStatus, { key: "confirme" | "en_attente" | "termine" | "annule" | "absent"; className: string; icon: typeof Clock }> = {
  PENDING: { key: "en_attente", className: "bg-warning-soft text-warning", icon: Hourglass },
  CONFIRMED: { key: "confirme", className: "bg-success-soft text-success", icon: CircleCheck },
  IN_PROGRESS: { key: "confirme", className: "bg-success-soft text-success", icon: CircleCheck },
  COMPLETED: { key: "termine", className: "bg-muted text-muted-foreground", icon: CircleCheck },
  CANCELLED: { key: "annule", className: "bg-danger-soft text-destructive", icon: CalendarX },
  NO_SHOW: { key: "absent", className: "bg-danger-soft text-destructive", icon: UserX },
};

function BookingList({ bookings, i18n }: { bookings: AccountBooking[]; i18n: I18n }) {
  const { t, tc, f, money, df } = i18n;
  const bk = t.account.bookings;
  if (!bookings.length) {
    return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">{bk.empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const st = STATUS_UI[b.status];
        const service = b.items.map((i) => tc(i.name)).join(" + ");
        const active = b.status === "CONFIRMED" || b.status === "PENDING";
        return (
          <li key={b.id} className="flex flex-col gap-4 rounded-3xl bg-card p-4 ring-1 ring-border sm:flex-row sm:items-center sm:p-5">
            <div className="flex items-center gap-4">
              <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-blush text-plum-800">
                <span className="text-[11px] font-medium">{df(b.local.date, { weekday: "short" })}</span>
                <span className="text-xl leading-none font-semibold">{df(b.local.date, { day: "numeric" })}</span>
                <span className="text-[11px]">{df(b.local.date, { month: "short" })}</span>
              </div>
              {b.salon.coverUrl && (
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                  <Image src={b.salon.coverUrl} alt="" fill sizes="64px" className="object-cover" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{service}</p>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", st.className)}>
                  <st.icon className="size-3.5" aria-hidden /> {t.account.status[st.key]}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                <Link href={`/salons/${b.salon.slug}`} className="font-medium text-foreground hover:underline">
                  {b.salon.name}
                </Link>{" "}
                · {f(t.account.overview.withName, { name: b.employee.name })} · <span className="tabular-nums">{b.local.time}</span> · {money(b.totalPrice)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {active && (
                <>
                  <Link href={`/salons/${b.salon.slug}/reserver`} className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted">
                    {t.account.overview.reschedule}
                  </Link>
                  <CancelBookingButton bookingId={b.id} />
                </>
              )}
              {b.status === "COMPLETED" && !b.review && (
                <ReviewDialog bookingId={b.id} salonName={b.salon.name} label={f(bk.review, { pts: f(t.common.plusPoints, { n: 15 }) })} />
              )}
              {(b.status === "COMPLETED" || b.status === "CANCELLED" || b.status === "NO_SHOW") && (
                <Link
                  href={`/salons/${b.salon.slug}/reserver`}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-plum-300 px-4 text-sm font-semibold text-plum-800 hover:bg-plum-50"
                >
                  <Repeat className="size-4" aria-hidden /> {t.account.overview.again}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function RendezVousPage() {
  const user = await requirePageUser();
  const [i18n, { upcoming, past, cancelled }] = await Promise.all([getI18n(), getAccountSummary(user.id)]);
  const bk = i18n.t.account.bookings;

  return (
    <div>
      <h1 data-animate="split" className="display text-4xl text-ink">
        {bk.title}
      </h1>
      <Tabs defaultValue="avenir" className="mt-6">
        <TabsList className="no-scrollbar h-11 max-w-full justify-start overflow-x-auto rounded-full p-1">
          <TabsTrigger value="avenir" className="rounded-full px-4">
            {bk.upcoming}
          </TabsTrigger>
          <TabsTrigger value="passes" className="rounded-full px-4">
            {bk.past}
          </TabsTrigger>
          <TabsTrigger value="annules" className="rounded-full px-4">
            {bk.cancelled}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="avenir" className="mt-4">
          <BookingList bookings={upcoming} i18n={i18n} />
        </TabsContent>
        <TabsContent value="passes" className="mt-4">
          <BookingList bookings={past} i18n={i18n} />
        </TabsContent>
        <TabsContent value="annules" className="mt-4">
          <BookingList bookings={cancelled} i18n={i18n} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
