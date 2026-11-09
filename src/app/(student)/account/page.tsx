import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { AccountPanel } from "@/features/auth/AccountPanel";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.account, robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getT();
  return (
    <>
      <PageHeading eyebrow={t.account.eyebrow} title={t.account.title} description={t.account.text} />
      <AccountPanel />
    </>
  );
}
