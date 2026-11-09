"use client";

import { useId, useRef, useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { UPLOADS_ENABLED } from "@/lib/config";
import { ApiError } from "@/lib/api/client";
import { deleteApplicationDocument, documentDownloadUrl, uploadApplicationDocument } from "@/lib/api/uploads";
import { ACCEPTED_LABELS, ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, formatBytes, validateFile } from "@/lib/uploads";
import type { AttachedFile } from "@/types";
import styles from "./DocumentUpload.module.css";

type State =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "local"; file: File } // envio desligado: verificado, mas não enviado
  | { kind: "sending"; file: File }
  | { kind: "error"; message: string };

type Props = {
  applicationId: string;
  documentName: string;
  /** Arquivo já anexado (vem da candidatura). */
  current?: AttachedFile;
  /** Chamado depois que o servidor aceitou (null = removido). */
  onChange?: (file: AttachedFile | null) => void;
  enabled?: boolean;
  upload?: typeof uploadApplicationDocument;
  remove?: typeof deleteApplicationDocument;
};

/**
 * Anexar o arquivo de um item do checklist. Valida tipo e tamanho no navegador; o servidor confere de novo
 * pelo conteúdo. Com o envio ligado, o arquivo sobe assim que é escolhido. Desligado (modo demonstração),
 * deixa claro que o arquivo NÃO saiu do computador.
 */
export function DocumentUpload({
  applicationId, documentName, current, onChange, enabled = UPLOADS_ENABLED,
  upload = uploadApplicationDocument, remove = deleteApplicationDocument
}: Props) {
  const t = useT();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [removing, setRemoving] = useState(false);
  const size = (n: number) => formatBytes(n, t.meta.dateLocale);
  const limit = size(MAX_UPLOAD_BYTES);

  const send = async (file: File) => {
    setState({ kind: "sending", file });
    try {
      const saved = await upload(applicationId, documentName, file);
      setState({ kind: "idle" });
      onChange?.(saved);
    } catch (error) {
      const invalid = error instanceof ApiError && error.status === 422 && error.fields?.file === "invalid_type";
      const tooBig = error instanceof ApiError && error.status === 413;
      setState({ kind: "error", message: invalid ? t.upload.invalidOnServer : tooBig ? t.upload.errors.size(limit) : t.upload.failed });
    }
  };

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file);
    // Permite escolher o mesmo arquivo de novo depois de um erro.
    if (input.current) input.current.value = "";
    if (problem === "type") return setState({ kind: "invalid", message: t.upload.errors.type(ACCEPTED_LABELS) });
    if (problem === "size") return setState({ kind: "invalid", message: t.upload.errors.size(limit) });
    if (problem === "empty") return setState({ kind: "invalid", message: t.upload.errors.empty });
    if (!enabled) return setState({ kind: "local", file });
    void send(file);
  };

  const removeCurrent = async () => {
    setRemoving(true);
    try {
      await remove(applicationId, documentName);
      onChange?.(null);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: t.upload.removeFailed });
    } finally {
      setRemoving(false);
    }
  };

  const busy = state.kind === "sending" || removing;

  return (
    <div className={styles.wrap}>
      <input
        ref={input}
        id={inputId}
        type="file"
        className={styles.input}
        accept={ACCEPT_ATTRIBUTE}
        aria-label={t.upload.label(documentName)}
        aria-describedby={`${inputId}-hint`}
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <label htmlFor={inputId} className={styles.trigger} aria-disabled={busy || undefined}>
        <Paperclip size={14} aria-hidden="true" />
        {state.kind === "sending" ? t.upload.sending : current || state.kind === "local" ? t.upload.replace : t.application.attach}
      </label>
      <span id={`${inputId}-hint`} className="visually-hidden">{t.upload.hint(ACCEPTED_LABELS, limit)}</span>

      <div className={styles.feedback} role="status">
        {(state.kind === "invalid" || state.kind === "error") && <p className={styles.error} role="alert">{state.message}</p>}
        {state.kind === "local" && (
          <div className={styles.file}>
            <p>{t.upload.ready(state.file.name, size(state.file.size))}</p>
            <p className={styles.muted}>{t.upload.disabled}</p>
            <div className={styles.actions}>
              <Button size="sm" variant="tertiary" onClick={() => setState({ kind: "idle" })}>{t.upload.remove}</Button>
            </div>
          </div>
        )}
        {current && state.kind !== "sending" && (
          <div className={styles.file}>
            <p className="visually-hidden">{t.upload.attached}</p>
            <a className={styles.download} href={documentDownloadUrl(applicationId, documentName)} download={current.name}>
              <Download size={14} aria-hidden="true" />
              {t.upload.download(current.name, size(current.size))}
            </a>
            <div className={styles.actions}>
              <Button size="sm" variant="tertiary" loading={removing} onClick={() => void removeCurrent()}>{t.upload.remove}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
