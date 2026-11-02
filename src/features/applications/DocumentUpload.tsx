"use client";

import { useId, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { UPLOADS_ENABLED } from "@/lib/config";
import { uploadApplicationDocument } from "@/lib/api/uploads";
import { ACCEPTED_LABELS, ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, formatBytes, validateFile } from "@/lib/uploads";
import styles from "./DocumentUpload.module.css";

type State =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "ready"; file: File }
  | { kind: "sending"; file: File }
  | { kind: "sent"; file: File }
  | { kind: "failed"; file: File };

type Uploader = typeof uploadApplicationDocument;

/**
 * Anexar o arquivo de um item do checklist. Valida tipo e tamanho no navegador.
 * Com o envio desligado (padrão), deixa claro que o arquivo NÃO saiu do computador.
 */
export function DocumentUpload({ applicationId, documentName, enabled = UPLOADS_ENABLED, upload = uploadApplicationDocument }: {
  applicationId: string;
  documentName: string;
  enabled?: boolean;
  upload?: Uploader;
}) {
  const t = useT();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const size = (n: number) => formatBytes(n, t.meta.dateLocale);
  const limit = size(MAX_UPLOAD_BYTES);

  const pick = (file: File | undefined) => {
    if (!file) return;
    const problem = validateFile(file);
    if (problem === "type") setState({ kind: "invalid", message: t.upload.errors.type(ACCEPTED_LABELS) });
    else if (problem === "size") setState({ kind: "invalid", message: t.upload.errors.size(limit) });
    else if (problem === "empty") setState({ kind: "invalid", message: t.upload.errors.empty });
    else setState({ kind: "ready", file });
    // Permite escolher o mesmo arquivo de novo depois de um erro.
    if (input.current) input.current.value = "";
  };

  const send = async (file: File) => {
    setState({ kind: "sending", file });
    try {
      await upload(applicationId, documentName, file);
      setState({ kind: "sent", file });
    } catch {
      setState({ kind: "failed", file });
    }
  };

  const hasFile = state.kind === "ready" || state.kind === "sending" || state.kind === "sent" || state.kind === "failed";

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
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <label htmlFor={inputId} className={styles.trigger}>
        <Paperclip size={14} aria-hidden="true" />
        {hasFile ? t.upload.replace : t.application.attach}
      </label>
      <span id={`${inputId}-hint`} className="visually-hidden">{t.upload.hint(ACCEPTED_LABELS, limit)}</span>

      <div className={styles.feedback} role="status">
        {state.kind === "invalid" && <p className={styles.error} role="alert">{state.message}</p>}
        {hasFile && (
          <div className={styles.file}>
            <p>{state.kind === "sent" ? t.upload.sent(state.file.name) : t.upload.ready(state.file.name, size(state.file.size))}</p>
            {!enabled && state.kind === "ready" && <p className={styles.muted}>{t.upload.disabled}</p>}
            {state.kind === "failed" && <p className={styles.error}>{t.upload.failed}</p>}
            <div className={styles.actions}>
              {enabled && state.kind !== "sent" && (
                <Button size="sm" variant="secondary" loading={state.kind === "sending"} onClick={() => void send(state.file)}>
                  {state.kind === "sending" ? t.upload.sending : t.upload.send}
                </Button>
              )}
              {state.kind !== "sending" && (
                <Button size="sm" variant="tertiary" onClick={() => setState({ kind: "idle" })}>{t.upload.remove}</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
