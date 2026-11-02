"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SelectField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { APPLICATION_STATUSES } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
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

      {status === "loading" && <p className="t-secondary" role="status">Carregando candidaturas…</p>}
      {status === "error" && <ErrorState title="Não foi possível carregar suas candidaturas" onRetry={reload} />}

      {status === "ready" && sorted.length === 0 && (
        <EmptyState
          title="Nenhuma candidatura ainda"
          description="Salve bolsas na busca para acompanhá-las aqui, com status e prazos."
          action={<ButtonLink href="/scholarships" size="sm">Buscar bolsas</ButtonLink>}
        />
      )}

      {status === "ready" && sorted.length > 0 && (
        <ul className={patterns.list} aria-label="Suas candidaturas">
          {sorted.map((app) => (
            <li key={app.id} className={styles.row}>
              <div>
                <h2><Link href={`/scholarships/${app.id}`}>{app.scholarship.title}</Link></h2>
                <p className="t-meta">{app.scholarship.institution} · Prazo: {formatDate(app.scholarship.deadline)}</p>
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
                <Button variant="tertiary" size="sm" aria-label={`Remover ${app.scholarship.title}`} onClick={() => void remove(app.id)}>Remover</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
