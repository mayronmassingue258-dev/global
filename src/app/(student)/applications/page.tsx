import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { ApplicationsBoard } from "@/features/applications/ApplicationsBoard";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.applications, robots: { index: false } };
}

export default async function ApplicationsPage() {
  const t = await getT();
  return (
    <>
      <PageHeading eyebrow={t.applications.eyebrow} title={t.applications.title} description={t.applications.text} />
      <ApplicationsBoard />
    </>
  );
}
