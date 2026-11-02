"use client";

import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { useT } from "@/i18n/I18nProvider";
import type { EligibilityResult as Result, EligibilityStatus } from "@/types";
import styles from "./EligibilityResult.module.css";

const tone: Record<EligibilityStatus, BadgeTone> = { eligible: "success", possible: "warning", not_eligible: "danger" };

/** Exibe o resultado calculado pelo backend. O frontend NÃO calcula elegibilidade nem mostra probabilidades. */
export function EligibilityResult({ result }: { result: Result }) {
  const t = useT();
  const info = t.eligibility.summary[result.status];
  return (
    <div className={styles.group}>
      <div><Badge tone={tone[result.status]}>{info.badge}</Badge></div>
      <h2 className="t-section">{info.title}</h2>
      <ul className={styles.list}>
        {result.reasons.map((reason) => (
          <li key={`${reason.kind}-${reason.text}`} className={styles[reason.kind]}>
            <span className={styles.tag}>{t.eligibility.kind[reason.kind]}</span>
            <span>{reason.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
