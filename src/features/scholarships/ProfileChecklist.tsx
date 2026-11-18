"use client";

import Link from "next/link";
import { FitScore } from "@/features/matching/FitScore";
import { ReasonList } from "@/features/matching/ReasonList";
import type { EligibilityResult } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import styles from "./ProfileChecklist.module.css";

/**
 * "O que falta no seu perfil": a avaliação do servidor (nota e motivos), pendências primeiro.
 * O frontend não calcula nada; só ordena e apresenta.
 */
export function ProfileChecklist({ result, scholarshipId, signedIn = true }: { result: EligibilityResult | null; scholarshipId: string; signedIn?: boolean }) {
  const t = useT();
  if (!signedIn) {
    return (
      <div className={styles.wrap}>
        <p className="t-meta">{t.checklist.signIn}</p>
        <div className={styles.links}><Link href={`/login?next=${encodeURIComponent(`/scholarships/${scholarshipId}`)}`}>{t.checklist.signInLink}</Link></div>
      </div>
    );
  }
  if (!result) {
    return <p className="t-meta">{t.checklist.unavailable}</p>;
  }
  const pending = result.reasons.filter((r) => r.kind === "missing" || r.kind === "gap").length;
  const missingInfo = result.reasons.some((r) => r.kind === "missing");

  return (
    <div className={styles.wrap}>
      {result.status === "not_eligible"
        ? <p className={styles.summary}>{t.checklist.notEligible}</p>
        : <FitScore score={result.score} fit={result.fit} />}
      {result.status !== "not_eligible" && (
        <p className={styles.summary}>{pending === 0 ? t.checklist.nonePending : t.checklist.pending(pending)}</p>
      )}
      <ReasonList reasons={result.reasons} limit={6} />
      <div className={styles.links}>
        {missingInfo && <Link href="/profile">{t.checklist.complete}</Link>}
        <Link href={`/eligibility/${scholarshipId}`}>{t.checklist.seeFull}</Link>
      </div>
    </div>
  );
}
