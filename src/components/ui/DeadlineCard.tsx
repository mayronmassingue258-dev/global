import { CalendarClock } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { deadlineInfo } from "@/lib/utils/deadline";
import styles from "./DeadlineCard.module.css";

/** Prazo em destaque. A urgência aparece em texto ("Faltam 9 dias"), a cor só reforça. */
export function DeadlineCard({ deadline, timezone, label = "Prazo listado" }: { deadline: string; timezone?: string; label?: string }) {
  const info = deadlineInfo(deadline);
  return (
    <div className={`${styles.card} ${styles[info.tone]}`}>
      <CalendarClock size={18} aria-hidden="true" />
      <div>
        <p className={styles.label}>{label}</p>
        <p className={styles.date}>{formatDate(deadline)}</p>
        <p className={styles.left}>
          {info.label}
          {timezone === undefined ? "" : timezone ? ` · fuso ${timezone}` : " · fuso não informado"}
        </p>
      </div>
    </div>
  );
}
