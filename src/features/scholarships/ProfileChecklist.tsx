import Link from "next/link";
import { Check, Minus, X } from "lucide-react";
import type { EligibilityResult } from "@/types";
import styles from "./ProfileChecklist.module.css";

const icon = { met: Check, missing: Minus, failed: X } as const;
const srLabel = { met: "Atendido", missing: "Falta informar", failed: "Não atendido" } as const;

/**
 * "O que falta no seu perfil": lista os motivos da avaliação do servidor, pendências primeiro.
 * O frontend não calcula nada; só ordena e apresenta.
 */
export function ProfileChecklist({ result, scholarshipId }: { result: EligibilityResult | null; scholarshipId: string }) {
  if (!result) {
    return <p className="t-meta">A avaliação do seu perfil não está disponível agora.</p>;
  }
  const order = { failed: 0, missing: 1, met: 2 } as const;
  const reasons = [...result.reasons].sort((a, b) => order[a.kind] - order[b.kind]);
  const pending = reasons.filter((r) => r.kind === "missing").length;

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>
        {pending === 0 ? "Nada pendente no seu perfil para esta bolsa." : `${pending} ${pending === 1 ? "item pendente" : "itens pendentes"} no seu perfil.`}
      </p>
      <ul className={styles.list}>
        {reasons.map((reason) => {
          const Icon = icon[reason.kind];
          return (
            <li key={`${reason.kind}-${reason.text}`} className={styles[reason.kind]}>
              <span className={styles.icon} aria-hidden="true"><Icon size={14} strokeWidth={2.5} /></span>
              <span><span className="visually-hidden">{srLabel[reason.kind]}: </span>{reason.text}</span>
            </li>
          );
        })}
      </ul>
      <div className={styles.links}>
        {pending > 0 && <Link href="/profile">Completar perfil</Link>}
        <Link href={`/eligibility/${scholarshipId}`}>Ver avaliação completa</Link>
      </div>
    </div>
  );
}
