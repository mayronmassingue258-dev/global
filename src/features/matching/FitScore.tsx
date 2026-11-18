"use client";

import { useT } from "@/i18n/I18nProvider";
import type { Fit } from "@/types";
import styles from "./FitScore.module.css";

/** Nota de compatibilidade (0–100) com barra e rótulo. A barra é decorativa: o texto diz tudo. */
export function FitScore({ score, fit }: { score: number; fit: Fit }) {
  const t = useT();
  return (
    <div className={`${styles.wrap} ${styles[fit]}`}>
      <p className={styles.top}>
        <span className={styles.label}>{t.vocab.fit[fit]}</span>
        <span className={styles.score} aria-hidden="true">{t.recommendations.score(score)}</span>
        <span className="visually-hidden">{t.recommendations.scoreLabel(score)}</span>
      </p>
      <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.max(2, Math.min(100, score))}%` }} /></span>
    </div>
  );
}
