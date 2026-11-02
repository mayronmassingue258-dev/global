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
import { APPLICATION_STATUSES } from "@/lib/constants";
import { useT } from "@/i18n/I18nProvider";
import type { Dictionary } from "@/i18n/config";
import { documentProgress } from "@/lib/applications/applyUpdate";
import { formatDateTime } from "@/lib/utils/date";
import type { Application, ApplicationStatus, TimelineEvent } from "@/types";
import { useApplications } from "./ApplicationsProvider";
import { DocumentUpload } from "./DocumentUpload";
import styles from "./ApplicationDetail.module.css";

const NOTES_DEBOUNCE_MS = 800;
type SaveState = "idle" | "pending" | "saving" | "saved" | "failed";

function describe(t: Dictionary, event: TimelineEvent): string {
  const e = t.application.events;
  switch (event.kind) {
    case "created": return e.created;
    case "status": return e.status(t.status[event.status]);
    case "document": return event.done ? e.docDone(event.document) : e.docUndone(event.document);
    case "notes": return e.notes;
  }
}

export function ApplicationDetail({ id }: { id: string }) {
  const { applications, status, reload } = useApplications();
  const t = useT();
  const app = applications.find((a) => a.id === id);

  return (
    <>
      <BackLink href="/applications">{t.application.back}</BackLink>
      {status === "loading" && (
        <div className={styles.loading}>
          <Skeleton width="60%" height={40} />
          <FormSkeleton fields={2} label={t.application.loading} />
        </div>
      )}
      {status === "error" && <ErrorState title={t.application.loadFailed} onRetry={reload} />}
      {status === "ready" && !app && (
        <EmptyState
          icon={FileQuestion}
          title={t.application.notFound}
          description={t.application.notFoundText}
          action={<ButtonLink href="/applications" variant="secondary" size="sm">{t.application.seeAll}</ButtonLink>}
        />
      )}
      {status === "ready" && app && <Workspace app={app} />}
    </>
  );
}

function Workspace({ app }: { app: Application }) {
  const { update, remove } = useApplications();
  const t = useT();
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
        <p className="t-label">{t.application.eyebrow(t.status[app.status])}</p>
        <h1 className="t-title">{app.scholarship.title}</h1>
        <p className="t-secondary">{app.scholarship.institution}</p>
      </header>

      <div className={styles.grid}>
        <aside className={styles.aside} aria-label={t.application.asideLabel}>
          <DeadlineCard deadline={app.scholarship.deadline} />
          <div className={styles.panel}>
            <SelectField label={t.applications.status} value={app.status} onChange={(e) => void update(app.id, { status: e.target.value as ApplicationStatus })}>
              {APPLICATION_STATUSES.map((s) => <option key={s.value} value={s.value}>{t.status[s.value]}</option>)}
            </SelectField>
            <p className="t-meta">{t.application.submittedNote}</p>
            <div className={styles.links}>
              <Link href={`/scholarships/${app.scholarship.id}`}>{t.application.seeScholarship}</Link>
              <Link href={`/assistant?program=${encodeURIComponent(app.scholarship.title)}`}>{t.application.writeDocument}</Link>
            </div>
            {confirmRemove ? (
              <div className={styles.confirm} role="group" aria-label={t.application.removeConfirmGroup}>
                <p>{t.application.removeQuestion}</p>
                <div className={styles.links}>
                  <Button variant="destructive" size="sm" onClick={() => void removeAndLeave()}>{t.application.removeYes}</Button>
                  <Button variant="tertiary" size="sm" onClick={() => setConfirmRemove(false)}>{t.common.cancel}</Button>
                </div>
              </div>
            ) : (
              <div><Button variant="tertiary" size="sm" onClick={() => setConfirmRemove(true)}>{t.application.remove}</Button></div>
            )}
          </div>
        </aside>

        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="ad-docs">
            <div className={styles.sectionHead}>
              <h2 id="ad-docs" className="t-section">{t.application.documents}</h2>
              {progress.total > 0 && <p className="t-meta" aria-live="polite">{t.application.ready(progress.done, progress.total)}</p>}
            </div>
            {progress.total > 0 && (
              <div className={styles.progress} aria-hidden="true"><span style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            )}
            {app.documents.length === 0 ? (
              <p className="t-secondary">{t.application.noDocuments}</p>
            ) : (
              <ul className={styles.checklist}>
                {app.documents.map((doc) => (
                  <li key={doc.name} className={styles.docRow}>
                    <label className={styles.check}>
                      <input type="checkbox" checked={doc.done} onChange={(e) => void update(app.id, { documents: [{ name: doc.name, done: e.target.checked }] })} />
                      <span className={styles.box} aria-hidden="true" />
                      <span className={styles.docName}>{doc.name}</span>
                    </label>
                    <DocumentUpload applicationId={app.id} documentName={doc.name} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-labelledby="ad-notes">
            <h2 id="ad-notes" className="t-section">{t.application.notes}</h2>
            <TextAreaField
              label={t.application.notesLabel}
              helper={t.application.notesHelper}
              value={notes}
              maxLength={5000}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={() => { if (notesState === "pending") void saveNotes(); }}
              className={styles.notes}
            />
            <p className="t-meta" role="status">
              {notesState === "pending" && t.application.notesPending}
              {notesState === "saving" && t.application.notesSaving}
              {notesState === "saved" && t.application.notesSaved}
              {notesState === "failed" && t.application.notesFailed}
            </p>
          </section>

          <section className={styles.section} aria-labelledby="ad-timeline">
            <h2 id="ad-timeline" className="t-section">{t.application.timeline}</h2>
            <ol className={styles.timeline}>
              {timeline.map((event, i) => (
                <li key={`${event.at}-${i}`}>
                  <time dateTime={event.at} className="t-meta">{formatDateTime(event.at, t.meta.dateLocale)}</time>
                  <span>{describe(t, event)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
