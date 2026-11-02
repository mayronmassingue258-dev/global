import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Notice } from "@/components/feedback/States";
import { BackLink } from "@/components/layout/PageHeading";
import { EligibilityResult } from "@/features/eligibility/EligibilityResult";
import { IS_MOCK_MODE } from "@/lib/config";
import { scholarshipService } from "@/lib/services";
import patterns from "@/styles/patterns.module.css";


/** Uma única chamada à API por pedido, compartilhada entre generateMetadata e a página. */
const getScholarship = cache((id: string) => scholarshipService.get(id));

type Props = { params: Promise<{ scholarshipId: string }> };

// notFound() aqui (antes de a página começar a ser transmitida) garante o status HTTP 404 para bolsas inexistentes.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scholarshipId } = await params;
  const item = await getScholarship(scholarshipId);
  if (!item) notFound();
  return { title: `Elegibilidade · ${item.title}`, robots: { index: false } };
}

export default async function EligibilityPage({ params }: Props) {
  const { scholarshipId } = await params;
  const item = await getScholarship(scholarshipId);
  if (!item) notFound();
  const result = await scholarshipService.eligibility(scholarshipId);

  return (
    <div className={patterns.page}>
      <div>
        <BackLink href={`/scholarships/${item.id}`}>Voltar à bolsa</BackLink>
        <p className="t-label">Elegibilidade</p>
        <h1 className="t-title">{item.title}</h1>
      </div>

      {result ? <EligibilityResult result={result} /> : <Notice>O resultado de elegibilidade não está disponível para esta bolsa.</Notice>}

      <Notice>
        {IS_MOCK_MODE ? "Resultado fictício de demonstração. " : ""}
        A avaliação é feita pelo servidor com base nas informações do seu perfil e nos critérios publicados. Ela não garante aprovação nem financiamento.
      </Notice>

      <div className={patterns.actions}>
        {result?.status === "possible" && <ButtonLink href="/profile">Completar perfil</ButtonLink>}
        <ButtonLink href={`/scholarships/${item.id}`} variant="secondary">Ver requisitos</ButtonLink>
      </div>
    </div>
  );
}
