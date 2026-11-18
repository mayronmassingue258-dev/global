"use client";

import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { FitScore } from "@/features/matching/FitScore";
import { ReasonList } from "@/features/matching/ReasonList";
import { useT } from "@/i18n/I18nProvider";
import type { EligibilityResult as Result, EligibilityStatus } from "@/types";
import styles from "./EligibilityResult.module.css";

const tone: Record<EligibilityStatus, BadgeTone> = { eligible: "success", possible: "warning", not_eligible: "danger" };

/** Exibe o resultado calculado pelo backend (elegibilidade, nota e motivos). O frontend NÃO calcula nada. */
export function EligibilityResult({ result }: { result: Result }) {
  const t = useT();
  const info = t.eligibility.summary[result.status];
  return (
    <div className={styles.group}>
      <div><Badge tone={tone[result.status]}>{info.badge}</Badge></div>
      <h2 className="t-section">{info.title}</h2>
      {result.status !== "not_eligible" && (
        <div className={styles.score}>
          <p className="t-label">{t.eligibility.scoreTitle}</p>
          <FitScore score={result.score} fit={result.fit} />
        </div>
      )}
      <ReasonList reasons={result.reasons} />
    </div>
  );
}
