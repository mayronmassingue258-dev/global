import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageHeading } from "@/components/layout/PageHeading";
import { ScholarshipCard } from "@/features/scholarships/ScholarshipCard";
import { UpcomingDeadlines } from "@/features/applications/UpcomingDeadlines";
import { scholarshipService } from "@/lib/services";
import patterns from "@/styles/patterns.module.css";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage() {
  const { items } = await scholarshipService.list({ sort: "deadline", pageSize: 3 });

  return (
    <div className={patterns.page}>
      <PageHeading eyebrow="Seu espaço de trabalho" title="Seus próximos passos." description="Acompanhe prazos, avalie oportunidades e avance nas suas candidaturas." />

      <section className={patterns.section} aria-labelledby="d-deadlines">
        <div className={patterns.sectionHead}>
          <h2 id="d-deadlines" className="t-section">Próximos prazos</h2>
          <ButtonLink href="/applications" variant="tertiary" size="sm">Ver candidaturas</ButtonLink>
        </div>
        <UpcomingDeadlines />
      </section>

      <section className={patterns.section} aria-labelledby="d-recommended">
        <div className={patterns.sectionHead}>
          <h2 id="d-recommended" className="t-section">Bolsas para avaliar</h2>
          <ButtonLink href="/scholarships" variant="tertiary" size="sm">Ver todas</ButtonLink>
        </div>
        <ul className={patterns.list}>{items.map((item) => <ScholarshipCard key={item.id} item={item} />)}</ul>
      </section>

      <div className={patterns.grid2}>
        <div className={patterns.dark}>
          <p className="t-label">Próxima ação</p>
          <h2 className="t-section">Complete seu perfil acadêmico</h2>
          <p>Com mais informações, a avaliação de elegibilidade fica mais útil.</p>
          <ButtonLink href="/profile" variant="inverse" size="sm">Continuar perfil</ButtonLink>
        </div>
        <div className={patterns.panel}>
          <h2 className="t-section">Documentos</h2>
          <p className="t-secondary">Prepare roteiros de carta de motivação, currículo acadêmico e declaração pessoal.</p>
          <div><ButtonLink href="/assistant" variant="secondary" size="sm">Abrir assistente</ButtonLink></div>
        </div>
      </div>
    </div>
  );
}
