import type { Metadata } from "next";
import { ManageHeader } from "@/components/manage/kit";
import { ProfileForm } from "@/components/manage/profile-form";
import { requirePageUser } from "@/infrastructure/session";
import { getI18n } from "@/i18n/server";
import { getProfile } from "@/modules/account";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.manage.profile.title };
}

/** CLI-01 : profil client modifiable */
export default async function ProfilePage() {
  const user = await requirePageUser();
  const [{ t }, profile] = await Promise.all([getI18n(), getProfile(user.id)]);
  return (
    <div className="space-y-6">
      <ManageHeader title={t.manage.profile.title} description={t.manage.profile.description} />
      <ProfileForm
        profile={{
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          phone: profile.phone,
          city: profile.city,
          birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
          locale: profile.locale,
          avatarUrl: profile.avatarUrl,
          emailVerified: profile.emailVerified,
        }}
      />
    </div>
  );
}
