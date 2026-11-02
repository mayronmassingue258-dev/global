"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { DeadlineCard } from "@/components/ui/DeadlineCard";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { FormSkeleton, Skeleton } from "@/components/feedback/Skeleton";
import { BackLink } from "@/components/layout/PageHeading";
import { APPLICATION_STATUSES, statusLabel } from "@/lib/constants";
import { documentProgress } from "@/lib/applications/applyUpdate";
import { formatDateTime } from "@/lib/utils/date";
import type { Application, ApplicationStatus, TimelineEvent } from "@/types";
import { useApplications } from "./ApplicationsProvider";
import styles from "./ApplicationDetail.module.css";

const NOTES_DEBOUNCE_MS = 800;
type SaveState = "idle" | "pending" | "saving" | "saved" | "failed";

function describe(event: TimelineEvent): string {
  switch (event.kind) {
    case "created": return "Bolsa salva para acompanhamento";
    case "status": return `Status alterado para “${statusLabel(event.status)}”`;
    case "document": return `${event.done ? "Documento pronto" : "Documento desmarcado"}: ${event.document}`;
    case "notes": return "Notas atualizadas";
  }
}

export function ApplicationDetail({ id }: { id: string }) {
  const { applications, status, reload } = useApplications();
  const app = applications.find((a) => a.id === id);

  return (
    <>
      <BackLink href="/applications">Voltar às candidaturas</BackLink>
      {status === "loading" && (
        <div className={styles.loading}>
          <Skeleton width="60%" height={40} />
          <FormSkeleton fields={2} label="Carregando candidatura…" />
        </div>
      )}
      {status === "error" && <ErrorState title="Não foi possível carregar a candidatura" onRetry={reload} />}
      {status === "ready" && !app && (
        <EmptyState
          icon={FileQuestion}
          title="Candidatura não encontrada"
          description="Ela pode ter sido removida. Salve a bolsa de novo para voltar a acompanhá-la."
          action={<ButtonLink href="/applications" variant="secondary" size="sm">Ver candidaturas</ButtonLink>}
        />
      )}
      {status === "ready" && app && <Workspace app={app} />}
    </>
  );
}

function Workspace({ app }: { app: Application }) {
  const { update, remove } = useApplications();
  const router = useRouter();
  const progress = documentProgress(app);

  // Notas: o texto local é a fonte de verdade enquanto o estudante digita; salva sozinho após uma pausa.
  const [notes, setNotes] = useState(app.notes);
  const [notesState, setNotesState] = useState<SaveState>("idle");
  const latest = useRef(notes);
  latest.current = notes;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNotes = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNotesState("saving");
    const ok = await update(app.id, { notes: latest.current });
    setNotesState(ok ? "saved" : "failed");
  };

  const onNotesChange = (value: string) => {
    setNotes(value);
    setNotesState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveNotes(), NOTES_DEBOUNCE_MS);
  };

  // Ao sair da página com uma edição pendente, salva na hora.
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void update(app.id, { notes: latest.current });
    }
  }, [app.id, update]);

  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeAndLeave = async () => {
    await remove(app.id);
    router.push("/applications");
  };

  const timeline = [...app.timeline].reverse();

  return (
    <>
      <header className={styles.header}>
        <p className="t-label">Candidatura · {statusLabel(app.status)}</p>
        <h1 className="t-title">{app.scholarship.title}</h1>
        <p className="t-secondary">{app.scholarship.institution}</p>
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside} aria-label="Status e prazo">
          <DeadlineCard deadline={app.scholarship.deadline} />
          <div className={styles.panel}>
            <SelectField label="Status" value={app.status} onChange={(e) => void update(app.id, { status: e.target.value as ApplicationStatus })}>
              {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </SelectField>
            <p className="t-meta">“Enviada” é só uma marcação sua. Confirme o envio no site oficial.</p>
            <div className={styles.links}>
              <Link href={`/scholarships/${app.scholarship.id}`}>Ver detalhes da bolsa</Link>
              <Link href={`/assistant?program=${encodeURIComponent(app.scholarship.title)}`}>Escrever um documento para esta bolsa</Link>
            </div>
            {confirmRemove ? (
              <div className={styles.confirm} role="group" aria-label="Confirmar remoção">
                <p>Remover esta candidatura, com notas e checklist?</p>
                <div className={styles.links}>
                  <Button variant="destructive" size="sm" onClick={() => void removeAndLeave()}>Sim, remover</Button>
                  <Button variant="tertiary" size="sm" onClick={() => setConfirmRemove(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div><Button variant="tertiary" size="sm" onClick={() => setConfirmRemove(true)}>Remover candidatura</Button></div>
            )}
          </div>
        </aside>

        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="ad-docs">
            <div className={styles.sectionHead}>
              <h2 id="ad-docs" className="t-section">Documentos</h2>
              {progress.total > 0 && <p className="t-meta" aria-live="polite">{progress.done} de {progress.total} prontos</p>}
            </div>
            {progress.total > 0 && (
              <div className={styles.progress} aria-hidden="true"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            )}
            {app.documents.length === 0 ? (
              <p className="t-secondary">Esta bolsa não lista documentos. Confira o site oficial.</p>
            ) : (
              <ul className={styles.checklist}>
                {app.documents.map((doc) => (
                  <li key={doc.name}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={doc.done} onChange={(e) => void update(app.id, { documents: [{ name: doc.name, done: e.target.checked }] })} />
                      <span className={styles.box} aria-hidden="true" />
                      <span className={styles.docName}>{doc.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="ad-notes">
            <h2 id="ad-notes" className="t-section">Notas</h2>
            <TextAreaField
              label="Suas notas sobre esta candidatura"
              helper="Contatos, perguntas para o provedor, lembretes. Salvas automaticamente."
              value={notes}
              maxLength={5000}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={() => { if (notesState === "pending") void saveNotes(); }}
              className={styles.notes}
            />
            <p className="t-meta" role="status">
              {notesState === "pending" && "Alterações não salvas…"}
              {notesState === "saving" && "Salvando…"}
              {notesState === "saved" && "Notas salvas."}
              {notesState === "failed" && "Não foi possível salvar as notas. Continue editando para tentar de novo."}
            </p>
          </section>

          <section className={styles.section} aria-labelledby="ad-timeline">
            <h2 id="ad-timeline" className="t-section">Linha do tempo</h2>
            <ol className={styles.timeline}>
              {timeline.map((event, i) => (
                <li key={`${event.at}-${i}`}>
                  <time dateTime={event.at} className="t-meta">{formatDateTime(event.at)}</time>
                  <span>{describe(event)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
