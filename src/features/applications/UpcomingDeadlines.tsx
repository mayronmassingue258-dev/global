"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/feedback/States";
import { Badge } from "@/components/ui/Badge";
import { statusLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils/date";
import patterns from "@/styles/patterns.module.css";
import { useApplications } from "./ApplicationsProvider";
import styles from "./UpcomingDeadlines.module.css";

export function UpcomingDeadlines() {
  const { applications } = useApplications();
  const upcoming = [...applications].sort((a, b) => a.scholarship.deadline.localeCompare(b.scholarship.deadline)).slice(0, 3);

  if (upcoming.length === 0) {
    return (
      <EmptyState
        title="Nenhum prazo para acompanhar"
        description="Salve uma bolsa para ver o prazo aqui."
        action={<ButtonLink href="/scholarships" variant="secondary" size="sm">Buscar bolsas</ButtonLink>}
      />
    );
  }

  return (
    <ul className={patterns.list}>
      {upcoming.map((app) => (
        <li key={app.id} className={styles.row}>
          <Link href={`/scholarships/${app.id}`}>{app.scholarship.title}</Link>
          <div className={patterns.meta}>
            <span>Prazo: {formatDate(app.scholarship.deadline)}</span>
            <Badge tone="outline">{statusLabel(app.status)}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
