import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import type { EligibilityResult as Result, EligibilityStatus } from "@/types";
import styles from "./EligibilityResult.module.css";

const summary: Record<EligibilityStatus, { title: string; badge: string; tone: BadgeTone }> = {
  eligible: { title: "Elegível segundo os critérios conhecidos", badge: "Elegível", tone: "success" },
  possible: { title: "Possivelmente elegível: faltam informações", badge: "Faltam informações", tone: "warning" },
  not_eligible: { title: "Não elegível: um requisito obrigatório não é atendido", badge: "Não elegível", tone: "danger" }
};

const kindLabel = { met: "Atendido", missing: "Falta informar", failed: "Não atendido" } as const;

/** Exibe o resultado calculado pelo backend. O frontend NÃO calcula elegibilidade nem mostra probabilidades. */
export function EligibilityResult({ result }: { result: Result }) {
  const info = summary[result.status];
  return (
    <div className={styles.group}>
      <div><Badge tone={info.tone}>{info.badge}</Badge></div>
      <h2 className="t-section">{info.title}</h2>
      <ul className={styles.list}>
        {result.reasons.map((reason) => (
          <li key={`${reason.kind}-${reason.text}`} className={styles[reason.kind]}>
            <span className={styles.tag}>{kindLabel[reason.kind]}</span>
            <span>{reason.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
