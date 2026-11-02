import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Notice } from "@/components/feedback/States";
import { BackLink } from "@/components/layout/PageHeading";
import { EligibilityResult } from "@/features/eligibility/EligibilityResult";
import { IS_MOCK_MODE } from "@/lib/config";
import { scholarshipService } from "@/lib/services";
import patterns from "@/styles/patterns.module.css";

export const metadata: Metadata = { title: "Elegibilidade" };

export default async function EligibilityPage({ params }: { params: Promise<{ scholarshipId: string }> }) {
  const { scholarshipId } = await params;
  const item = await scholarshipService.get(scholarshipId);
  if (!item) notFound();
  const result = await scholarshipService.eligibility(scholarshipId);

  return (
    <div className={patterns.page}>
      <div>
        <BackLink href={`/scholarships/${item.id}`}>{item.title}</BackLink>
        <p className="t-label">Elegibilidade</p>
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
