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
import type { DocumentType, Draft, DraftInput } from "@/types";
import { TEMPLATES, TEMPLATE_LIST, countWords, toPlainText } from "./templates";
import styles from "./AssistantWorkspace.module.css";

const AUTOSAVE_MS = 1000;
type LoadStatus = "loading" | "ready" | "error";
type SaveState = "saved" | "pending" | "saving" | "failed";

/**
 * Espaço de documento: lista de rascunhos, estrutura por seções e editor com salvamento automático.
 * O assistente organiza; quem escreve é o estudante. Nenhum serviço de IA está conectado.
 */
export function AssistantWorkspace({ service = draftService }: { service?: DraftService }) {
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
      <aside className={styles.sidebar} aria-label="Rascunhos">
        <div className={styles.sidebarHead}>
          <h2 className={styles.sidebarTitle}>Rascunhos</h2>
          <Button size="sm" variant="secondary" onClick={() => { setCreating(true); router.replace(pathname, { scroll: false }); }}>
            <FilePlus2 size={16} aria-hidden="true" /> Novo
          </Button>
        </div>
        {status === "loading" && <ListSkeleton rows={2} label="Carregando rascunhos…" />}
        {status === "error" && <ErrorState title="Não foi possível carregar os rascunhos" onRetry={() => setReloadKey((k) => k + 1)} />}
        {status === "ready" && drafts.length === 0 && <p className="t-meta">Nenhum rascunho ainda.</p>}
        {status === "ready" && drafts.length > 0 && (
          <ul className={styles.draftList}>
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" className={styles.draftItem} aria-current={d.id === selectedId ? "true" : undefined} onClick={() => select(d.id)}>
                  <span className={styles.draftTitle}>{d.title}</span>
                  <span className="t-meta">{TEMPLATES[d.type].label} · {formatDateTime(d.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {IS_MOCK_MODE && <p className="t-meta">Demonstração: os rascunhos ficam só nesta aba.</p>}
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
            title={selectedId ? "Rascunho não encontrado" : "Escolha um rascunho"}
            description="Abra um rascunho na lista ou comece um documento novo."
            action={<Button size="sm" onClick={() => setCreating(true)}>Novo documento</Button>}
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
  const [type, setType] = useState<DocumentType>("motivation_letter");
  const [title, setTitle] = useState("");
  const [program, setProgram] = useState(initialProgram);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalTitle = title.trim() || `${TEMPLATES[type].label}${program.trim() ? ` — ${program.trim()}` : ""}`;
    setBusy(true);
    setError("");
    try {
      const draft = await service.create({ type, title: finalTitle.slice(0, DRAFT_LIMITS.title), program: program.trim(), sections: {} });
      onCreated(draft);
    } catch {
      setError("Não foi possível criar o rascunho. Tente novamente.");
      setBusy(false);
      titleRef.current?.focus();
    }
  }

  return (
    <form className={styles.newForm} onSubmit={submit} aria-labelledby="new-draft-title">
      <div>
        <p className="t-label">Novo documento</p>
        <h2 id="new-draft-title" className="t-section">O que você vai escrever?</h2>
      </div>
      <fieldset className={styles.types}>
        <legend className="visually-hidden">Tipo de documento</legend>
        {TEMPLATE_LIST.map((t) => (
          <label key={t.type} className={styles.typeCard}>
            <input type="radio" name="type" value={t.type} checked={type === t.type} onChange={() => setType(t.type)} />
            <span className={styles.typeBody}>
              <span className={styles.typeLabel}>{t.label}</span>
              <span className="t-meta">{t.description}</span>
              <span className="t-meta">{t.sections.length} seções</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className={styles.fields}>
        <TextField ref={titleRef} label="Título do rascunho" optional value={title} maxLength={DRAFT_LIMITS.title} onChange={(e) => setTitle(e.target.value)} placeholder={TEMPLATES[type].label} />
        <TextField label="Bolsa ou programa" optional value={program} maxLength={DRAFT_LIMITS.program} onChange={(e) => setProgram(e.target.value)} placeholder="Ex.: Mestrado em Ciência de Dados" />
      </div>
      {error && <Notice role="alert">{error}</Notice>}
      <div className={styles.formActions}>
        <Button type="submit" loading={busy}>Criar rascunho</Button>
        {onCancel && <Button variant="tertiary" onClick={onCancel}>Cancelar</Button>}
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
  const template = TEMPLATES[draft.type];
  const [values, setValues] = useState<DraftInput>({ type: draft.type, title: draft.title, program: draft.program, sections: draft.sections });
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(draft.updatedAt);
  const [message, setMessage] = useState("");
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
      setMessage("Dê um título ao rascunho para salvar.");
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
      }
      savedCallback.current(saved);
    } catch {
      setSaveState("failed");
      setMessage("Não foi possível salvar. Suas alterações continuam na tela; tentaremos de novo na próxima edição.");
    }
  }, [draft.id, service]);

  const change = (next: Partial<DraftInput>) => {
    setValues((v) => ({ ...v, ...next }));
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(toPlainText(values.title, values.type, values.sections));
      setMessage("Documento copiado.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  async function remove() {
    try {
      await service.remove(draft.id);
      onDeleted(draft.id);
    } catch {
      setMessage("Não foi possível excluir o rascunho.");
      setConfirmDelete(false);
    }
  }

  const totalWords = template.sections.reduce((sum, s) => sum + countWords(values.sections[s.key] ?? ""), 0);

  return (
    <div className={styles.editor}>
      <nav className={styles.outline} aria-label="Estrutura do documento">
        <p className="t-label">Estrutura</p>
        <ol>
          {template.sections.map((s) => {
            const words = countWords(values.sections[s.key] ?? "");
            const done = words >= Math.max(1, s.targetWords[0]);
            return (
              <li key={s.key}>
                <a href={`#sec-${s.key}`} className={done ? styles.outlineDone : undefined}>
                  <span className={styles.outlineMark} aria-hidden="true">{done && <Check size={12} strokeWidth={3} />}</span>
                  <span>{s.title}</span>
                  <span className={styles.outlineCount}>{words}<span className="visually-hidden"> palavras{done ? ", seção iniciada" : ""}</span></span>
                </a>
              </li>
            );
          })}
        </ol>
        <p className="t-meta">{totalWords} palavras no total</p>
      </nav>

      <article className={styles.document} aria-label={values.title || "Rascunho"}>
        <header className={styles.docHeader}>
          <p className="t-label">{template.label}</p>
          <label className="visually-hidden" htmlFor="draft-title">Título do rascunho</label>
          <input id="draft-title" className={styles.titleInput} value={values.title} maxLength={DRAFT_LIMITS.title}
            onChange={(e) => change({ title: e.target.value })} aria-invalid={!values.title.trim() || undefined} />
          <TextField label="Bolsa ou programa" optional value={values.program} maxLength={DRAFT_LIMITS.program} onChange={(e) => change({ program: e.target.value })} />
          <div className={styles.toolbar}>
            <p className={styles.saveState} role="status" data-state={saveState}>
              {saveState === "saved" && `Salvo · ${formatDateTime(savedAt)}`}
              {saveState === "pending" && "Alterações não salvas…"}
              {saveState === "saving" && "Salvando…"}
              {saveState === "failed" && "Não salvo"}
            </p>
            <div className={styles.toolbarActions}>
              <Button size="sm" variant="secondary" onClick={() => void copy()}>Copiar documento</Button>
              {confirmDelete ? (
                <>
                  <Button size="sm" variant="destructive" onClick={() => void remove()}>Confirmar exclusão</Button>
                  <Button size="sm" variant="tertiary" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
                </>
              ) : (
                <Button size="sm" variant="tertiary" onClick={() => setConfirmDelete(true)}>Excluir</Button>
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
                {words} {words === 1 ? "palavra" : "palavras"} · referência {min > 0 ? `${min}–${max}` : `até ${max}`}
                {words > max ? " (acima da referência)" : ""}
              </p>
            </section>
          );
        })}

        <Notice>Quem escreve é você: o assistente só organiza a estrutura e não usa IA. Inclua apenas informações verdadeiras e confira o limite do edital.</Notice>
      </article>
    </div>
  );
}
