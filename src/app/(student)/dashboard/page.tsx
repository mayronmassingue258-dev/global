import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeading } from "@/components/layout/PageHeading";
import { UpcomingDeadlines } from "@/features/applications/UpcomingDeadlines";
import { RecommendationList } from "@/features/recommendations/RecommendationList";
import { getT } from "@/i18n/server";
import patterns from "@/styles/patterns.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.dashboard, robots: { index: false } };
}

// Página por pedido (idioma e sessão vêm do cookie); nada é pré-gerado no build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = await getT();

  return (
    <div className={patterns.page}>
      <PageHeading eyebrow={t.dashboard.eyebrow} title={t.dashboard.title} description={t.dashboard.text} />

      <section className={patterns.section} aria-labelledby="d-deadlines">
        <div className={patterns.sectionHead}>
          <h2 id="d-deadlines" className="t-section">{t.dashboard.deadlines}</h2>
          <ButtonLink href="/applications" variant="tertiary" size="sm">{t.dashboard.seeApplications}</ButtonLink>
        </div>
        <UpcomingDeadlines />
      </section>

      <section className={patterns.section} aria-labelledby="d-recommended">
        <div className={patterns.sectionHead}>
          <h2 id="d-recommended" className="t-section">{t.recommendations.dashboardTitle}</h2>
          <ButtonLink href="/recommendations" variant="tertiary" size="sm">{t.recommendations.dashboardSeeAll}</ButtonLink>
        </div>
        <RecommendationList limit={3} compact />
      </section>

      <div className={patterns.grid2}>
        <div className={patterns.dark}>
          <p className="t-label">{t.dashboard.nextAction}</p>
          <h2 className="t-section">{t.dashboard.completeProfile}</h2>
          <p>{t.dashboard.completeProfileText}</p>
          <ButtonLink href="/profile" variant="inverse" size="sm">{t.dashboard.continueProfile}</ButtonLink>
        </div>
        <div className={patterns.panel}>
          <h2 className="t-section">{t.dashboard.documents}</h2>
          <p className="t-secondary">{t.dashboard.documentsText}</p>
          <div><ButtonLink href="/assistant" variant="secondary" size="sm">{t.dashboard.openAssistant}</ButtonLink></div>
        </div>
      </div>
    </div>
  );
}
