"use client";

import { CalendarClock } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { formatDate } from "@/lib/utils/date";
import { deadlineInfo } from "@/lib/utils/deadline";
import styles from "./DeadlineCard.module.css";

/**
 * Prazo em destaque. A urgência aparece em texto ("Faltam 9 dias"), a cor só reforça.
 * `timezone`: omitido = não mostrar; "" = mostrar "fuso não informado".
 */
export function DeadlineCard({ deadline, timezone }: { deadline: string; timezone?: string }) {
  const t = useT();
  const info = deadlineInfo(deadline, new Date(), t.deadline);
  return (
    <div className={`${styles.card} ${styles[info.tone]}`}>
      <CalendarClock size={18} aria-hidden="true" />
      <div>
        <p className={styles.label}>{t.deadline.listed}</p>
        <p className={styles.date}>{formatDate(deadline, t.meta.dateLocale, t.common.dateInvalid)}</p>
        <p className={styles.left}>
          {info.label}
          {timezone === undefined ? "" : timezone ? t.deadline.timezone(timezone) : t.deadline.timezoneUnknown}
        </p>
      </div>
    </div>
  );
}
