import type { Metadata } from "next";
import { PageHeading } from "@/components/layout/PageHeading";
import { RecommendationList } from "@/features/recommendations/RecommendationList";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.recommendations, robots: { index: false } };
}

export default async function RecommendationsPage() {
  const t = await getT();
  return (
    <>
      <PageHeading eyebrow={t.recommendations.eyebrow} title={t.recommendations.title} description={t.recommendations.text} />
      <RecommendationList limit={10} />
    </>
  );
}
