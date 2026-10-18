import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getI18n } from "@/i18n/server";
import { getSalonDetail } from "@/modules/catalog";
import { tunisToday } from "@/core/domain/time";
import { getProfile } from "@/modules/account";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.booking.metaTitle };
}

export default async function ReserverPage({ params, searchParams }: PageProps<"/salons/[slug]/reserver">) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await auth();
  const detail = await getSalonDetail(slug, session?.user.id);
  if (!detail) notFound();
  const profile = session?.user.role === "CLIENT" ? await getProfile(session.user.id) : null;

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const heure = one(sp.heure);
  const knownService = (key?: string) => (key && detail.serviceGroups.some((g) => g.services.some((s) => s.id === key)) ? key : undefined);
  const defaultService = detail.serviceGroups[0]?.services[0]?.id;

  return (
    <div className="container-page pt-6 pb-16">
      <BookingFlow
        salon={detail.salon}
        serviceGroups={detail.serviceGroups}
        employees={detail.employees}
        openWeekdays={detail.openingHours.filter((h) => h.hours).map((h) => h.weekday)}
        today={tunisToday()}
        user={profile ? { name: `${profile.firstName} ${profile.lastName}`.trim(), email: profile.email, phone: profile.phone } : null}
        initialServiceId={knownService(one(sp.service)) ?? (heure ? defaultService : undefined)}
        initialTime={heure}
      />
    </div>
  );
}
