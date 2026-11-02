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
import { useApplications } from "./ApplicationsProvider";
import styles from "./ApplicationsBoard.module.css";

export function ApplicationsBoard() {
  const { applications, status, setStatus, remove, reload } = useApplications();
  const sorted = [...applications].sort((a, b) => a.scholarship.deadline.localeCompare(b.scholarship.deadline));

  return (
    <div className={patterns.stack}>
      <Notice>
        “Enviada” indica apenas o que você marcou aqui. A plataforma não envia candidaturas aos provedores das bolsas: confirme sempre no site oficial.
        {IS_MOCK_MODE ? " Nesta demonstração, as alterações não são salvas." : ""}
      </Notice>

      {status === "loading" && <ListSkeleton rows={3} label="Carregando candidaturas…" />}
      {status === "error" && <ErrorState title="Não foi possível carregar suas candidaturas" onRetry={reload} />}

      {status === "ready" && sorted.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="Nenhuma candidatura ainda"
          description="Salve bolsas na busca para acompanhá-las aqui, com documentos, notas e prazos."
          action={<ButtonLink href="/scholarships" size="sm">Buscar bolsas</ButtonLink>}
        />
      )}

      {status === "ready" && sorted.length > 0 && (
        <ul className={patterns.list} aria-label="Suas candidaturas">
          {sorted.map((app) => {
            const progress = documentProgress(app);
            return (
              <li key={app.id} className={styles.row}>
                <div className={styles.main}>
                  <h2><Link href={`/applications/${app.id}`}>{app.scholarship.title}</Link></h2>
                  <p className="t-meta">{app.scholarship.institution}</p>
                  <div className={patterns.meta}>
                    <span>Prazo: {formatDate(app.scholarship.deadline)}</span>
                    <DeadlineBadge deadline={app.scholarship.deadline} />
                    {progress.total > 0 && (
                      <span className={styles.progress}>
                        <span className={styles.bar} aria-hidden="true"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></span>
                        {progress.done} de {progress.total} documentos
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.controls}>
                  <SelectField
                    label="Status"
                    aria-label={`Status de ${app.scholarship.title}`}
                    value={app.status}
                    onChange={(e) => void setStatus(app.id, e.target.value as ApplicationStatus)}
                  >
                    {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </SelectField>
                  <ButtonLink href={`/applications/${app.id}`} variant="secondary" size="sm" aria-label={`Abrir ${app.scholarship.title}`}>Abrir</ButtonLink>
                  <Button variant="tertiary" size="sm" aria-label={`Remover ${app.scholarship.title}`} onClick={() => void remove(app.id)}>Remover</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
