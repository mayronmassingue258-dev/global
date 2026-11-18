"use client";

import { AlertTriangle, Check, Info, Minus, X } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import type { Reason } from "@/types";
import { reasonText } from "./reasons";
import styles from "./ReasonList.module.css";

const icon = { met: Check, gap: AlertTriangle, missing: Minus, failed: X, info: Info } as const;
const order = { failed: 0, gap: 1, missing: 2, met: 3, info: 4 } as const;

/** Motivos da avaliação (vindos do servidor como códigos), escritos no idioma da interface. Pendências primeiro. */
export function ReasonList({ reasons, limit }: { reasons: Reason[]; limit?: number }) {
  const t = useT();
  const sorted = [...reasons].sort((a, b) => order[a.kind] - order[b.kind]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  return (
    <ul className={styles.list}>
      {shown.map((reason, index) => {
        const Icon = icon[reason.kind];
        return (
          <li key={`${reason.code}-${index}`} className={styles[reason.kind]}>
            <span className={styles.icon} aria-hidden="true"><Icon size={13} strokeWidth={2.5} /></span>
            <span><span className="visually-hidden">{t.reasonKind[reason.kind]}: </span>{reasonText(reason, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}
