"use client";

import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import type { EligibilityResult } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import styles from "./ProfileChecklist.module.css";

const icon = { met: Check, missing: Minus, failed: X } as const;

/**
 * "O que falta no seu perfil": lista os motivos da avaliação do servidor, pendências primeiro.
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
  const order = { failed: 0, missing: 1, met: 2 } as const;
  const reasons = [...result.reasons].sort((a, b) => order[a.kind] - order[b.kind]);
  const pending = reasons.filter((r) => r.kind === "missing").length;

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>
        {pending === 0 ? t.checklist.nonePending : t.checklist.pending(pending)}
      </p>
      <ul className={styles.list}>
        {reasons.map((reason) => {
          const Icon = icon[reason.kind];
          return (
            <li key={`${reason.kind}-${reason.text}`} className={styles[reason.kind]}>
              <span className={styles.icon} aria-hidden="true"><Icon size={14} strokeWidth={2.5} /></span>
              <span><span className="visually-hidden">{t.eligibility.kind[reason.kind]}: </span>{reason.text}</span>
            </li>
          );
        })}
      </ul>
      <div className={styles.links}>
        {pending > 0 && <Link href="/profile">{t.checklist.complete}</Link>}
        <Link href={`/eligibility/${scholarshipId}`}>{t.checklist.seeFull}</Link>
      </div>
    </div>
  );
}
