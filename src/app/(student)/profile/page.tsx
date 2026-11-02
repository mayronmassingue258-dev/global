import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { IS_MOCK_MODE } from "@/lib/config";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.profile, robots: { index: false } };
}

export default async function ProfilePage() {
  const t = await getT();
  return (
    <>
      <PageHeading eyebrow={t.profile.eyebrow} title={t.profile.title} description={`${t.profile.text}${IS_MOCK_MODE ? t.profile.demoText : ""}`} />
      <ProfileForm />
    </>
  );
}
