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
import { getT } from "@/i18n/server";
import { getCurrentUser, sessionHeaders } from "@/lib/api/serverAuth";
import { jsonLdScript, scholarshipJsonLd } from "@/lib/seo";
import { formatDate } from "@/lib/utils/date";
import type { EligibilityResult } from "@/types";
import patterns from "@/styles/patterns.module.css";
import styles from "./page.module.css";

/** Uma única chamada à API por pedido, compartilhada entre generateMetadata e a página. */
const getScholarship = cache((id: string) => scholarshipService.get(id));

/** A avaliação é complementar: se falhar, a página da bolsa continua funcionando. */
async function getEligibility(id: string, signedIn: boolean): Promise<EligibilityResult | null> {
  if (!signedIn) return null;
  try {
    return await scholarshipService.eligibility(id, undefined, await sessionHeaders());
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
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/scholarships/${encodeURIComponent(item.id)}` },
    openGraph: { type: "article", title: item.title, description: item.summary }
  };
}

export default async function ScholarshipDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [item, eligibility, t] = await Promise.all([getScholarship(id), getEligibility(id, Boolean(user)), getT()]);
  if (!item) notFound();
  const level = t.levels[item.level] ?? item.level;
  const date = (iso: string) => formatDate(iso, t.meta.dateLocale, t.common.dateInvalid);

  const verified = item.verification.status === "verified";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(scholarshipJsonLd(item)) }} />
      <BackLink href="/scholarships">{t.detail.back}</BackLink>
      <header className={styles.header}>
        <p className="t-label">{item.country} · {level}</p>
        <h1 className={`t-title ${styles.title}`}>{item.title}</h1>
        <p className="t-secondary">{item.institution}</p>
        {t.detail.dataLanguageNote && <p className="t-meta" lang={t.meta.htmlLang}>{t.detail.dataLanguageNote}</p>}
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside} aria-label={t.detail.asideLabel}>
          <DeadlineCard deadline={item.deadline} timezone={item.deadlineTimezone ?? ""} />

          <div className={styles.panel}>
            <dl className={styles.facts}>
              <div><dt>{t.detail.funding}</dt><dd>{item.fundingType}</dd></div>
              <div><dt>{t.detail.level}</dt><dd>{level}</dd></div>
              <div><dt>{t.detail.source}</dt><dd><Badge tone={verified ? "success" : "outline"}>{verified ? t.scholarships.verified : t.scholarships.unverified}</Badge></dd></div>
            </dl>
            <div className={patterns.stack}>
              <SaveButton scholarship={item} variant="primary" label={t.detail.save} />
              {item.sourceUrl && (
                <ButtonLink href={item.sourceUrl} variant="secondary" target="_blank" rel="noopener noreferrer">
                  {t.detail.officialSite}<span className="visually-hidden"> {t.common.newTab}</span>
                </ButtonLink>
              )}
            </div>
          </div>

          <section className={styles.panel} aria-labelledby="s-missing">
            <h2 id="s-missing" className={styles.panelTitle}>{t.detail.missingTitle}</h2>
            <ProfileChecklist result={eligibility} scholarshipId={item.id} signedIn={Boolean(user)} />
          </section>
        </aside>

        <article className={styles.article}>
          <section className={patterns.section} aria-labelledby="s-about">
            <h2 id="s-about" className="t-section">{t.detail.about}</h2>
            <p className="t-secondary t-measure">{item.summary}</p>
            <p className="t-secondary t-measure"><strong>{t.detail.coverage}</strong> {item.funding}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-req">
            <h2 id="s-req" className="t-section">{t.detail.requirements}</h2>
            <ul className={patterns.bullets}>{item.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            {item.eligibleCountries && item.eligibleCountries.length > 0 && (
              <p className="t-secondary">{t.detail.countries(item.eligibleCountries.join(", "))}</p>
            )}
          </section>

          <section className={patterns.section} aria-labelledby="s-docs">
            <h2 id="s-docs" className="t-section">{t.detail.documents}</h2>
            <ul className={patterns.bullets}>{item.requiredDocuments.map((d) => <li key={d}>{d}</li>)}</ul>
            <p className="t-meta">{t.detail.documentsNote}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-process">
            <h2 id="s-process" className="t-section">{t.detail.process}</h2>
            <p className="t-secondary t-measure">{item.applicationProcess ?? t.detail.processUnknown}</p>
          </section>

          <section className={patterns.section} aria-labelledby="s-source">
            <h2 id="s-source" className="t-section">{t.detail.sourceTitle}</h2>
            <p className="t-secondary">
              {t.detail.officialSource}{" "}
              {item.sourceUrl ? <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceUrl}</a> : t.detail.notInformed}
            </p>
            <p className="t-secondary">
              {t.detail.lastVerified} {verified && item.verification.verifiedAt ? date(item.verification.verifiedAt) : t.detail.notVerified}
            </p>
            <Notice>{t.detail.disclaimer}</Notice>
          </section>
        </article>
      </div>
    </>
  );
}
