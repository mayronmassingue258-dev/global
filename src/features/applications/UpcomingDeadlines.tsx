"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CalendarClock } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/date";
import patterns from "@/styles/patterns.module.css";
import { useT } from "@/i18n/I18nProvider";
import { useApplications } from "./ApplicationsProvider";
import styles from "./UpcomingDeadlines.module.css";

export function UpcomingDeadlines() {
  const { applications, status, reload } = useApplications();
  const t = useT();

  if (status === "loading") return <ListSkeleton rows={2} label={t.dashboard.loadingDeadlines} />;
  if (status === "error") return <ErrorState title={t.dashboard.deadlinesFailed} onRetry={reload} />;

  const upcoming = [...applications].sort((a, b) => a.scholarship.deadline.localeCompare(b.scholarship.deadline)).slice(0, 3);

  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title={t.dashboard.noDeadlines}
        description={t.dashboard.noDeadlinesText}
        action={<ButtonLink href="/scholarships" variant="secondary" size="sm">{t.dashboard.searchScholarships}</ButtonLink>}
      />
    );
  }

  return (
    <ul className={patterns.list}>
      {upcoming.map((app) => (
        <li key={app.id} className={styles.row}>
          <Link href={`/applications/${app.id}`}>{app.scholarship.title}</Link>
          <div className={patterns.meta}>
            <span>{t.deadline.prefix} {formatDate(app.scholarship.deadline, t.meta.dateLocale, t.common.dateInvalid)}</span>
            <DeadlineBadge deadline={app.scholarship.deadline} />
            <Badge tone="outline">{t.status[app.status]}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
