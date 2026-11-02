import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Notice } from "@/components/feedback/States";
import { BackLink } from "@/components/layout/PageHeading";
import { SaveButton } from "@/features/scholarships/SaveButton";
import { scholarshipService } from "@/lib/services";
import { formatDate } from "@/lib/utils/date";
import patterns from "@/styles/patterns.module.css";
import styles from "./page.module.css";


/** Uma única chamada à API por pedido, compartilhada entre generateMetadata e a página. */
const getScholarship = cache((id: string) => scholarshipService.get(id));

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
  const item = await getScholarship(id);
  if (!item) notFound();

  const verified = item.verification.status === "verified";

  return (
    <>
      <BackLink href="/scholarships">Voltar às bolsas</BackLink>
      <div className={styles.grid}>
        <article className={patterns.page}>
          <header>
            <p className="t-label">{item.country} · {item.level}</p>
            <h1 className={`t-title ${styles.title}`}>{item.title}</h1>
            <p className="t-secondary">{item.institution}</p>
          </header>

          <section className={patterns.section} aria-labelledby="s-about">
            <h2 id="s-about" className="t-section">Sobre esta oportunidade</h2>
            <p className="t-secondary t-measure">{item.summary}</p>
            <p className="t-secondary t-measure"><strong>Financiamento:</strong> {item.funding}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-req">
            <h2 id="s-req" className="t-section">Requisitos de elegibilidade</h2>
            <ul className={patterns.bullets}>{item.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            {item.eligibleCountries && item.eligibleCountries.length > 0 && (
              <p className="t-secondary">Países elegíveis: {item.eligibleCountries.join(", ")}.</p>
            )}
          </section>

          <section className={patterns.section} aria-labelledby="s-docs">
            <h2 id="s-docs" className="t-section">Documentos necessários</h2>
            <ul className={patterns.bullets}>{item.requiredDocuments.map((d) => <li key={d}>{d}</li>)}</ul>
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

        <aside className={`${patterns.panel} ${styles.aside}`} aria-label="Resumo da oportunidade">
          <Badge tone={verified ? "success" : "outline"}>{verified ? "Verificada" : "Não verificada"}</Badge>
          <dl className={styles.facts}>
            <div><dt>Financiamento</dt><dd>{item.fundingType}</dd></div>
            <div><dt>Prazo listado</dt><dd>{formatDate(item.deadline)}{item.deadlineTimezone ? ` (${item.deadlineTimezone})` : " · fuso não informado"}</dd></div>
            <div><dt>Nível de estudo</dt><dd>{item.level}</dd></div>
          </dl>
          <div className={patterns.stack}>
            <SaveButton scholarship={item} variant="primary" label="Salvar bolsa" />
            <ButtonLink href={`/eligibility/${item.id}`} variant="secondary">Verificar elegibilidade</ButtonLink>
          </div>
        </aside>
      </div>
    </>
  );
}
