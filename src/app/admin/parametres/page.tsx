import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { AnnouncementForm, PlatformSettingsForm } from "@/components/manage/platform-settings";
import { utcToTunis } from "@/core/domain/time";
import { getI18n } from "@/i18n/server";
import { getPlatformSettings, listAnnouncements } from "@/modules/platform";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.platform.title };
}

/** ADM-05 / ADM-06 / ADM-10 : catalogue global, langues, commissions et annonces */
export default async function PlatformSettingsPage() {
  const [{ t, f, df }, settings, announcements] = await Promise.all([getI18n(), getPlatformSettings(), listAnnouncements()]);
  const m = t.manage.platform;
  return (
    <div className="space-y-8">
      <ManageHeader title={m.title} description={m.description} />
      <PlatformSettingsForm settings={settings} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AnnouncementForm />
        <section aria-labelledby="announcements-history" className="rounded-3xl bg-card p-5 ring-1 ring-border">
          <h2 id="announcements-history" className="mb-3 font-semibold">
            {m.history}
          </h2>
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.noAnnouncements}</p>
          ) : (
            <ul className="divide-y divide-border">
              {announcements.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">{m.audiences[a.audience]}</span>
                    {df(utcToTunis(a.createdAt).date, { day: "numeric", month: "short", year: "numeric" })} · {f(m.recipients, { n: a.recipients })}
                  </p>
                  <p className="mt-1 font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
