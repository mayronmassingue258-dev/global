"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, FilePlus2, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice } from "@/components/feedback/States";
import { ListSkeleton } from "@/components/feedback/Skeleton";
import { IS_MOCK_MODE } from "@/lib/config";
import type { DraftService } from "@/lib/api/drafts";
import { draftService } from "@/lib/services";
import { formatDateTime } from "@/lib/utils/date";
import { DRAFT_LIMITS } from "@/lib/validation/draft";
import { clearFormDraft, readFormDraft, writeFormDraft } from "@/lib/formDrafts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import type { DocumentType, Draft, DraftInput } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { DOCUMENT_TYPE_ORDER, countWords, getTemplate, toPlainText } from "./templates";
import styles from "./AssistantWorkspace.module.css";

const AUTOSAVE_MS = 1000;

const isDraftInput = (v: unknown): v is DraftInput => {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.type === "string" && typeof r.title === "string" && typeof r.program === "string" &&
    typeof r.sections === "object" && r.sections !== null && Object.values(r.sections).every((x) => typeof x === "string");
};
type LoadStatus = "loading" | "ready" | "error";
type SaveState = "saved" | "pending" | "saving" | "failed";

/**
 * Espaço de documento: lista de rascunhos, estrutura por seções e editor com salvamento automático.
 * O assistente organiza; quem escreve é o estudante. Nenhum serviço de IA está conectado.
 */
export function AssistantWorkspace({ service = draftService }: { service?: DraftService }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname() ?? "/assistant";
  const params = useSearchParams();
  const selectedId = params?.get("draft") ?? null;
  const programHint = params?.get("program") ?? "";

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    service
      .list(controller.signal)
      .then((items) => {
        setDrafts(items);
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [service, reloadKey]);

  const select = useCallback(
    (id: string | null) => {
      setCreating(false);
      router.replace(id ? `${pathname}?draft=${encodeURIComponent(id)}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const replaceDraft = useCallback((draft: Draft) => {
    setDrafts((current) => [draft, ...current.filter((d) => d.id !== draft.id)]);
  }, []);

  const selected = drafts.find((d) => d.id === selectedId) ?? null;
  const showForm = status === "ready" && (creating || drafts.length === 0 || (!selected && Boolean(programHint)));

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} aria-label={t.assistant.drafts}>
        <div className={styles.sidebarHead}>
          <h2 className={styles.sidebarTitle}>{t.assistant.drafts}</h2>
          <Button size="sm" variant="secondary" onClick={() => { setCreating(true); router.replace(pathname, { scroll: false }); }}>
            <FilePlus2 size={16} aria-hidden="true" /> {t.assistant.new}
          </Button>
        </div>
        {status === "loading" && <ListSkeleton rows={2} label={t.assistant.loadingDrafts} />}
        {status === "error" && <ErrorState title={t.assistant.draftsFailed} onRetry={() => setReloadKey((k) => k + 1)} />}
        {status === "ready" && drafts.length === 0 && <p className="t-meta">{t.assistant.noDrafts}</p>}
        {status === "ready" && drafts.length > 0 && (
          <ul className={styles.draftList}>
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" className={styles.draftItem} aria-current={d.id === selectedId ? "true" : undefined} onClick={() => select(d.id)}>
                  <span className={styles.draftTitle}>{d.title}</span>
                  <span className="t-meta">{t.templates[d.type].label} · {formatDateTime(d.updatedAt, t.meta.dateLocale)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {IS_MOCK_MODE && <p className="t-meta">{t.assistant.demo}</p>}
      </aside>

      <div className={styles.main}>
        {status === "ready" && showForm && (
          <NewDraftForm
            service={service}
            initialProgram={programHint}
            onCreated={(draft) => { replaceDraft(draft); select(draft.id); }}
            onCancel={drafts.length > 0 ? () => setCreating(false) : undefined}
          />
        )}
        {status === "ready" && !showForm && selected && (
          <Editor key={selected.id} draft={selected} service={service} onSaved={replaceDraft}
            onDeleted={(id) => { setDrafts((c) => c.filter((d) => d.id !== id)); select(null); }} />
        )}
        {status === "ready" && !showForm && !selected && (
          <EmptyState
            icon={FileText}
            title={selectedId ? t.assistant.notFound : t.assistant.choose}
            description={t.assistant.chooseText}
            action={<Button size="sm" onClick={() => setCreating(true)}>{t.assistant.newDocument}</Button>}
          />
        )}
      </div>
    </div>
  );
}

function NewDraftForm({ service, initialProgram, onCreated, onCancel }: {
  service: DraftService;
  initialProgram: string;
  onCreated: (draft: Draft) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const [type, setType] = useState<DocumentType>("motivation_letter");
  const [title, setTitle] = useState("");
  const [program, setProgram] = useState(initialProgram);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalTitle = title.trim() || `${t.templates[type].label}${program.trim() ? ` — ${program.trim()}` : ""}`;
    setBusy(true);
    setError("");
    try {
      const draft = await service.create({ type, title: finalTitle.slice(0, DRAFT_LIMITS.title), program: program.trim(), sections: {} });
      onCreated(draft);
    } catch {
      setError(t.assistant.createFailed);
      setBusy(false);
      titleRef.current?.focus();
    }
  }

  return (
    <form className={styles.newForm} onSubmit={submit} aria-labelledby="new-draft-title">
      <div>
        <p className="t-label">{t.assistant.newDocument}</p>
        <h2 id="new-draft-title" className="t-section">{t.assistant.whatToWrite}</h2>
      </div>
      <fieldset className={styles.types}>
        <legend className="visually-hidden">{t.assistant.docType}</legend>
        {DOCUMENT_TYPE_ORDER.map((code) => {
          const tpl = getTemplate(t, code);
          return (
            <label key={code} className={styles.typeCard}>
              <input type="radio" name="type" value={code} checked={type === code} onChange={() => setType(code)} />
              <span className={styles.typeBody}>
                <span className={styles.typeLabel}>{tpl.label}</span>
                <span className="t-meta">{tpl.description}</span>
                <span className="t-meta">{t.assistant.sectionsCount(tpl.sections.length)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className={styles.fields}>
        <TextField ref={titleRef} label={t.assistant.draftTitle} optional value={title} maxLength={DRAFT_LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder={t.templates[type].label} />
        <TextField label={t.assistant.program} optional value={program} maxLength={DRAFT_LIMITS.program} onChange={(e) => setProgram(e.target.value)} placeholder={t.assistant.programPlaceholder} />
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <div className={styles.formActions}>
        <Button type="submit" loading={busy}>{t.assistant.create}</Button>
        {onCancel && <Button variant="tertiary" onClick={onCancel}>{t.common.cancel}</Button>}
      </div>
    </form>
  );
}

function Editor({ draft, service, onSaved, onDeleted }: {
  draft: Draft;
  service: DraftService;
  onSaved: (draft: Draft) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useT();
  const template = getTemplate(t, draft.type);
  const backupKey = `draft:${draft.id}`;
  // Cópia de segurança na aba: se uma gravação falhou e a página foi recarregada, o texto volta.
  const [initial] = useState(() => {
    const server: DraftInput = { type: draft.type, title: draft.title, program: draft.program, sections: draft.sections };
    const backup = readFormDraft(backupKey, isDraftInput);
    const differs = backup && backup.type === draft.type && JSON.stringify(backup) !== JSON.stringify(server);
    return { values: differs ? backup : server, restored: Boolean(differs) };
  });
  const [values, setValues] = useState<DraftInput>(initial.values);
  const [saveState, setSaveState] = useState<SaveState>(initial.restored ? "pending" : "saved");
  const [savedAt, setSavedAt] = useState(draft.updatedAt);
  const [message, setMessage] = useState(initial.restored ? t.assistant.restored : "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const latest = useRef(values);
  latest.current = values;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;

  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const input = latest.current;
    if (!input.title.trim()) {
      setSaveState("failed");
      setMessage(t.assistant.needTitle);
      return;
    }
    setSaveState("saving");
    try {
      const saved = await service.update(draft.id, input);
      setSavedAt(saved.updatedAt);
      // Se o estudante continuou digitando durante o envio, mantém "pendente" e agenda outra gravação.
      if (latest.current === input) {
        setSaveState("saved");
        setMessage("");
        clearFormDraft(backupKey);
      }
      savedCallback.current(saved);
    } catch {
      setSaveState("failed");
      setMessage(t.assistant.saveFailed);
    }
  }, [draft.id, service, t, backupKey]);

  const change = (next: Partial<DraftInput>) => {
    setValues((v) => {
      const updated = { ...v, ...next };
      writeFormDraft(backupKey, updated);
      return updated;
    });
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  };

  // Ao trocar de rascunho ou sair da página com edição pendente, salva na hora.
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void service.update(draft.id, latest.current).then((d) => savedCallback.current(d)).catch(() => undefined);
    }
  }, [draft.id, service]);

  // Rascunho recuperado: tenta salvar logo ao abrir.
  useEffect(() => {
    if (initial.restored) void save();
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useUnsavedChangesWarning(saveState !== "saved");

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(template, values.title, values.sections));
      setMessage(t.assistant.copied);
    } catch {
      setMessage(t.assistant.copyFailed);
    }
  }

  async function remove() {
    try {
      await service.remove(draft.id);
      onDeleted(draft.id);
    } catch {
      setMessage(t.assistant.deleteFailed);
      setConfirmDelete(false);
    }
  }

  const totalWords = template.sections.reduce((sum, s) => sum + countWords(values.sections[s.key] ?? ""), 0);

  return (
    <div className={styles.editor}>
      <nav className={styles.outline} aria-label={t.assistant.outline}>
        <p className="t-label">{t.assistant.outlineLabel}</p>
        <ol>
          {template.sections.map((s) => {
            const words = countWords(values.sections[s.key] ?? "");
            const done = words >= Math.max(1, s.targetWords[0]);
            return (
              <li key={s.key}>
                <a href={`#sec-${s.key}`} className={done ? styles.outlineDone : undefined}>
                  <span className={styles.outlineMark} aria-hidden="true">{done && <Check size={12} strokeWidth={3} />}</span>
                  <span>{s.title}</span>
                  <span className={styles.outlineCount}>{words}<span className="visually-hidden">{t.assistant.wordsSr(done)}</span></span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="t-meta">{t.assistant.totalWords(totalWords)}</p>
      </nav>

      <article className={styles.document} aria-label={values.title || t.assistant.draftFallback}>
        <header className={styles.docHeader}>
          <p className="t-label">{template.label}</p>
          <label className="visually-hidden" htmlFor="draft-title">{t.assistant.draftTitle}</label>
          <input id="draft-title" className={styles.titleInput} value={values.title} maxLength={DRAFT_LIMITS.title}
            onChange={(e) => change({ title: e.target.value })} aria-invalid={!values.title.trim() || undefined} />
          <TextField label={t.assistant.program} optional value={values.program} maxLength={DRAFT_LIMITS.program} onChange={(e) => change({ program: e.target.value })} />
          <div className={styles.toolbar}>
            <p className={styles.saveState} role="status" data-state={saveState}>
              {saveState === "saved" && t.assistant.saved(formatDateTime(savedAt, t.meta.dateLocale))}
              {saveState === "pending" && t.assistant.pending}
              {saveState === "saving" && t.assistant.saving}
              {saveState === "failed" && t.assistant.failed}
            </p>
            <div className={styles.toolbarActions}>
              <Button size="sm" variant="secondary" onClick={() => void copy()}>{t.assistant.copy}</Button>
              {confirmDelete ? (
                <>
                  <Button size="sm" variant="destructive" onClick={() => void remove()}>{t.assistant.confirmDelete}</Button>
                  <Button size="sm" variant="tertiary" onClick={() => setConfirmDelete(false)}>{t.common.cancel}</Button>
                </>
              ) : (
                <Button size="sm" variant="tertiary" onClick={() => setConfirmDelete(true)}>{t.assistant.delete}</Button>
              )}
            </div>
          </div>
          {message && <Notice role="status">{message}</Notice>}
        </header>

        {template.sections.map((s, index) => {
          const text = values.sections[s.key] ?? "";
          const words = countWords(text);
          const [min, max] = s.targetWords;
          const id = `sec-${s.key}`;
          return (
            <section key={s.key} id={id} className={styles.section} aria-labelledby={`${id}-title`}>
              <h3 id={`${id}-title`} className={styles.sectionTitle}>
                <span className={styles.sectionNumber} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {s.title}
              </h3>
              <p id={`${id}-hint`} className={styles.hint}>{s.hint}</p>
              <textarea
                className={styles.textarea}
                aria-labelledby={`${id}-title`}
                aria-describedby={`${id}-hint ${id}-count`}
                value={text}
                maxLength={DRAFT_LIMITS.section}
                onChange={(e) => change({ sections: { ...latest.current.sections, [s.key]: e.target.value } })}
                onBlur={() => { if (timer.current) void save(); }}
              />
              <p id={`${id}-count`} className={`t-meta ${words > max ? styles.over : ""}`}>
                {t.assistant.words(words)} · {t.assistant.reference(min, max)}
                {words > max ? t.assistant.over : ""}
              </p>
            </section>
          );
        })}

        <Notice>{t.assistant.honesty}</Notice>
      </article>
    </div>
  );
}
