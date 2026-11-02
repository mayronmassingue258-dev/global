import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DeadlineCard } from "@/components/ui/DeadlineCard";
import { Notice } from "@/components/feedback/States";
import { BackLink } from "@/components/layout/PageHeading";
import { ProfileChecklist } from "@/features/scholarships/ProfileChecklist";
import { SaveButton } from "@/features/scholarships/SaveButton";
import { scholarshipService } from "@/lib/services";
import { formatDate } from "@/lib/utils/date";
import type { EligibilityResult } from "@/types";
import patterns from "@/styles/patterns.module.css";
import styles from "./page.module.css";

/** Uma única chamada à API por pedido, compartilhada entre generateMetadata e a página. */
const getScholarship = cache((id: string) => scholarshipService.get(id));

/** A avaliação é complementar: se falhar, a página da bolsa continua funcionando. */
async function getEligibility(id: string): Promise<EligibilityResult | null> {
  try {
    return await scholarshipService.eligibility(id);
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getScholarship(id);
  // notFound() aqui (antes de a página começar a ser transmitida) garante o status HTTP 404.
  if (!item) notFound();
  return { title: item.title, description: item.summary };
}

export default async function ScholarshipDetailPage({ params }: Props) {
  const { id } = await params;
  const [item, eligibility] = await Promise.all([getScholarship(id), getEligibility(id)]);
  if (!item) notFound();

  const verified = item.verification.status === "verified";

  return (
    <>
      <BackLink href="/scholarships">Voltar às bolsas</BackLink>
      <header className={styles.header}>
        <p className="t-label">{item.country} · {item.level}</p>
        <h1 className={`t-title ${styles.title}`}>{item.title}</h1>
        <p className="t-secondary">{item.institution}</p>
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside} aria-label="Resumo e próximos passos">
          <DeadlineCard deadline={item.deadline} timezone={item.deadlineTimezone ?? ""} />

          <div className={styles.panel}>
            <dl className={styles.facts}>
              <div><dt>Financiamento</dt><dd>{item.fundingType}</dd></div>
              <div><dt>Nível</dt><dd>{item.level}</dd></div>
              <div><dt>Fonte</dt><dd><Badge tone={verified ? "success" : "outline"}>{verified ? "Verificada" : "Não verificada"}</Badge></dd></div>
            </dl>
            <div className={patterns.stack}>
              <SaveButton scholarship={item} variant="primary" label="Salvar bolsa" />
              {item.sourceUrl && (
                <ButtonLink href={item.sourceUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
                  Site oficial<span className="visually-hidden"> (abre em nova aba)</span>
                </ButtonLink>
              )}
            </div>
          </div>

          <section className={styles.panel} aria-labelledby="s-missing">
            <h2 id="s-missing" className={styles.panelTitle}>O que falta no seu perfil</h2>
            <ProfileChecklist result={eligibility} scholarshipId={item.id} />
          </section>
        </aside>

        <article className={styles.article}>
          <section className={patterns.section} aria-labelledby="s-about">
            <h2 id="s-about" className="t-section">Sobre esta oportunidade</h2>
            <p className="t-secondary t-measure">{item.summary}</p>
            <p className="t-secondary t-measure"><strong>Cobertura:</strong> {item.funding}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-req">
            <h2 id="s-req" className="t-section">Requisitos de elegibilidade</h2>
            <ul className={patterns.bullets}>{item.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            {item.eligibleCountries && item.eligibleCountries.length > 0 && (
              <p className="t-secondary">Países de residência aceitos: {item.eligibleCountries.join(", ")}.</p>
            )}
          </section>

          <section className={patterns.section} aria-labelledby="s-docs">
            <h2 id="s-docs" className="t-section">Documentos necessários</h2>
            <ul className={patterns.bullets}>{item.requiredDocuments.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="t-meta">Ao salvar a bolsa, estes documentos viram um checklist na sua candidatura.</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-process">
            <h2 id="s-process" className="t-section">Processo de candidatura</h2>
            <p className="t-secondary t-measure">{item.applicationProcess ?? "Informação não disponível. Consulte a fonte oficial."}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-source">
            <h2 id="s-source" className="t-section">Fonte e verificação</h2>
            <p className="t-secondary">
              Fonte oficial:{" "}
              {item.sourceUrl ? <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceUrl}</a> : "não informada"}
            </p>
            <p className="t-secondary">
              Última verificação: {verified && item.verification.verifiedAt ? formatDate(item.verification.verifiedAt) : "não verificada"}
            </p>
            <Notice>Esta plataforma não garante elegibilidade nem aprovação. Confirme todos os detalhes com o provedor oficial antes de agir.</Notice>
          </section>
        </article>
      </div>
    </>
  );
}
