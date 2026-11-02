import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeading } from "@/components/layout/PageHeading";
import { ErrorState } from "@/components/feedback/States";
import { ScholarshipCard } from "@/features/scholarships/ScholarshipCard";
import { UpcomingDeadlines } from "@/features/applications/UpcomingDeadlines";
import { getT } from "@/i18n/server";
import { scholarshipService } from "@/lib/services";
import type { Scholarship } from "@/types";
import patterns from "@/styles/patterns.module.css";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.titles.dashboard, robots: { index: false } };
}

// Os dados vêm da API a cada pedido: a página não pode ser pré-gerada no build (a API não existe nessa hora).
export const dynamic = "force-dynamic";

async function loadRecommended(): Promise<Scholarship[] | null> {
  try {
    const { items } = await scholarshipService.list({ sort: "deadline", pageSize: 3 });
    return items;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const [t, items] = await Promise.all([getT(), loadRecommended()]);

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
          <h2 id="d-recommended" className="t-section">{t.dashboard.toEvaluate}</h2>
          <ButtonLink href="/scholarships" variant="tertiary" size="sm">{t.dashboard.seeAll}</ButtonLink>
        </div>
        {items ? (
          <ul className={patterns.list}>{items.map((item) => <ScholarshipCard key={item.id} item={item} />)}</ul>
        ) : (
          <ErrorState title={t.dashboard.loadFailed} description={t.states.serverDown} />
        )}
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
