import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeading } from "@/components/layout/PageHeading";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { ScholarshipBrowser } from "@/features/scholarships/ScholarshipBrowser";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.meta.titles.scholarships, description: t.scholarships.text, alternates: { canonical: "/scholarships" } };
}

export default async function ScholarshipsPage() {
  const t = await getT();
  return (
    <>
      <PageHeading eyebrow={t.scholarships.eyebrow} title={t.scholarships.title} description={t.scholarships.text} />
      {/* Os filtros vêm da URL (useSearchParams), o que exige um limite de Suspense. */}
      <Suspense fallback={<ListSkeleton rows={4} variant="card" label={t.common.loading} />}>
        <ScholarshipBrowser />
      </Suspense>
    </>
  );
}
