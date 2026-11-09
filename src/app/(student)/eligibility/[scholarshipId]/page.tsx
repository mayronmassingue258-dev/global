import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Notice } from "@/components/feedback/States";
import { BackLink } from "@/components/layout/PageHeading";
import { EligibilityResult } from "@/features/eligibility/EligibilityResult";
import { IS_MOCK_MODE } from "@/lib/config";
import { scholarshipService } from "@/lib/services";
import { getT } from "@/i18n/server";
import { sessionHeaders } from "@/lib/api/serverAuth";
import patterns from "@/styles/patterns.module.css";


/** Uma única chamada à API por pedido, compartilhada entre generateMetadata e a página. */
const getScholarship = cache((id: string) => scholarshipService.get(id));

type Props = { params: Promise<{ scholarshipId: string }> };

// notFound() aqui (antes de a página começar a ser transmitida) garante o status HTTP 404 para bolsas inexistentes.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scholarshipId } = await params;
  const item = await getScholarship(scholarshipId);
  if (!item) notFound();
  const t = await getT();
  return { title: `${t.meta.titles.eligibility} · ${item.title}`, robots: { index: false } };
}

export default async function EligibilityPage({ params }: Props) {
  const { scholarshipId } = await params;
  const item = await getScholarship(scholarshipId);
  if (!item) notFound();
  const [result, t] = await Promise.all([sessionHeaders().then((headers) => scholarshipService.eligibility(scholarshipId, undefined, headers)), getT()]);

  return (
    <div className={patterns.page}>
      <div>
        <BackLink href={`/scholarships/${item.id}`}>{t.eligibility.back}</BackLink>
        <p className="t-label">{t.eligibility.label}</p>
        <h1 className="t-title">{item.title}</h1>
      </div>

      {result ? <EligibilityResult result={result} /> : <Notice>{t.eligibility.unavailable}</Notice>}

      <Notice>
        {IS_MOCK_MODE ? t.eligibility.demo : ""}
        {t.eligibility.disclaimer}
      </Notice>

      <div className={patterns.actions}>
        {result?.status === "possible" && <ButtonLink href="/profile">{t.eligibility.completeProfile}</ButtonLink>}
        <ButtonLink href={`/scholarships/${item.id}`} variant="secondary">{t.eligibility.seeRequirements}</ButtonLink>
      </div>
    </div>
  );
}
