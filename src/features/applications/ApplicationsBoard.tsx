"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import { SelectField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
import { documentProgress } from "@/lib/applications/applyUpdate";
import { formatDate } from "@/lib/utils/date";
import type { ApplicationStatus } from "@/types";
import patterns from "@/styles/patterns.module.css";
import { useT } from "@/i18n/I18nProvider";
import { useApplications } from "./ApplicationsProvider";
import styles from "./ApplicationsBoard.module.css";

export function ApplicationsBoard() {
  const { applications, status, setStatus, remove, reload } = useApplications();
  const t = useT();
  const sorted = [...applications].sort((a, b) => a.scholarship.deadline.localeCompare(b.scholarship.deadline));

  return (
    <div className={patterns.stack}>
      <Notice>
        {t.applications.notice}
        {IS_MOCK_MODE ? t.applications.noticeDemo : ""}
      </Notice>

      {status === "loading" && <ListSkeleton rows={3} label={t.applications.loading} />}
      {status === "error" && <ErrorState title={t.applications.loadFailed} onRetry={reload} />}

      {status === "ready" && sorted.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title={t.applications.emptyTitle}
          description={t.applications.emptyText}
          action={<ButtonLink href="/scholarships" size="sm">{t.applications.search}</ButtonLink>}
        />
      )}

      {status === "ready" && sorted.length > 0 && (
        <ul className={patterns.list} aria-label={t.applications.listLabel}>
          {sorted.map((app) => {
            const progress = documentProgress(app);
            return (
              <li key={app.id} className={styles.row}>
                <div className={styles.main}>
                  <h2><Link href={`/applications/${app.id}`}>{app.scholarship.title}</Link></h2>
                  <p className="t-meta">{app.scholarship.institution}</p>
                  <div className={patterns.meta}>
                    <span>{t.deadline.prefix} {formatDate(app.scholarship.deadline, t.meta.dateLocale, t.common.dateInvalid)}</span>
                    <DeadlineBadge deadline={app.scholarship.deadline} />
                    {progress.total > 0 && (
                      <span className={styles.progress}>
                        <span className={styles.bar} aria-hidden="true"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></span>
                        {t.applications.docsProgress(progress.done, progress.total)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.controls}>
                  <SelectField
                    label={t.applications.status}
                    aria-label={t.applications.statusOf(app.scholarship.title)}
                    value={app.status}
                    onChange={(e) => void setStatus(app.id, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{t.status[s.value]}</option>)}
                  </SelectField>
                  <ButtonLink href={`/applications/${app.id}`} variant="secondary" size="sm" aria-label={t.applications.openNamed(app.scholarship.title)}>{t.applications.open}</ButtonLink>
                  <Button variant="tertiary" size="sm" aria-label={t.applications.removeNamed(app.scholarship.title)} onClick={() => void remove(app.id)}>{t.applications.remove}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
