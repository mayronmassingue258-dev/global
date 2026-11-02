"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CalendarClock } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import { Badge } from "@/components/ui/Badge";
import { statusLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils/date";
import patterns from "@/styles/patterns.module.css";
import { useApplications } from "./ApplicationsProvider";
import styles from "./UpcomingDeadlines.module.css";

export function UpcomingDeadlines() {
  const { applications, status, reload } = useApplications();

  if (status === "loading") return <ListSkeleton rows={2} label="Carregando prazos…" />;
  if (status === "error") return <ErrorState title="Não foi possível carregar seus prazos" onRetry={reload} />;

  const upcoming = [...applications].sort((a, b) => a.scholarship.deadline.localeCompare(b.scholarship.deadline)).slice(0, 3);

  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
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
          <Link href={`/applications/${app.id}`}>{app.scholarship.title}</Link>
          <div className={patterns.meta}>
            <span>Prazo: {formatDate(app.scholarship.deadline)}</span>
            <DeadlineBadge deadline={app.scholarship.deadline} />
            <Badge tone="outline">{statusLabel(app.status)}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
