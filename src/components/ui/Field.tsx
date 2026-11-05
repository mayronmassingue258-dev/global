"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { useT } from "@/i18n/I18nProvider";
import styles from "./Field.module.css";

type FieldMeta = { label: string; helper?: string; error?: string; optional?: boolean };

function Shell({ id, meta, children }: { id: string; meta: FieldMeta; children: ReactNode }) {
  const t = useT();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {meta.label}
        {meta.optional && <span className={styles.optional}> {t.common.optional}</span>}
      </label>
      {children}
      {meta.helper && <p id={`${id}-helper`} className={styles.helper}>{meta.helper}</p>}
      {meta.error && <p id={`${id}-error`} className={styles.error}>{t.common.errorPrefix} {meta.error}</p>}
    </div>
  );
}

function aria(id: string, meta: FieldMeta) {
  const describedBy = [meta.helper ? `${id}-helper` : "", meta.error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return { "aria-invalid": meta.error ? true : undefined, "aria-describedby": describedBy } as const;
}

export function TextField({ label, helper, error, optional, id, className, ...rest }: FieldMeta & ComponentPropsWithRef<"input">) {
  const auto = useId();
  const fieldId = id ?? auto;
  const meta = { label, helper, error, optional };
  return (
    <Shell id={fieldId} meta={meta}>
      <input id={fieldId} className={`${styles.control} ${error ? styles.invalid : ""} ${className ?? ""}`} {...aria(fieldId, meta)} {...rest} />
    </Shell>
  );
}

export function SelectField({ label, helper, error, optional, id, className, children, ...rest }: FieldMeta & ComponentPropsWithRef<"select">) {
  const auto = useId();
  const fieldId = id ?? auto;
  const meta = { label, helper, error, optional };
  return (
    <Shell id={fieldId} meta={meta}>
      <select id={fieldId} className={`${styles.control} ${error ? styles.invalid : ""} ${className ?? ""}`} {...aria(fieldId, meta)} {...rest}>
        {children}
      </select>
    </Shell>
  );
}

export function TextAreaField({ label, helper, error, optional, id, className, ...rest }: FieldMeta & ComponentPropsWithRef<"textarea">) {
  const auto = useId();
  const fieldId = id ?? auto;
  const meta = { label, helper, error, optional };
  return (
    <Shell id={fieldId} meta={meta}>
      <textarea id={fieldId} className={`${styles.control} ${error ? styles.invalid : ""} ${className ?? ""}`} {...aria(fieldId, meta)} {...rest} />
    </Shell>
  );
}

/**
 * Campo de senha: SEMPRE oculta por padrão (type="password"). O botão de olho mostra a senha só quando a pessoa pede
 * (útil em senhas longas) e ela volta a ficar oculta quando o formulário é enviado.
 * Enquanto visível, o corretor e a maiúscula automática ficam desligados para o texto não ir ao dicionário do teclado.
 * Leitores de tela anunciam o estado pelo aria-pressed do botão ("Mostrar senha, pressionado").
 */
export function PasswordField({ label, helper, error, optional, id, className, ref: externalRef, ...rest }: FieldMeta & Omit<ComponentPropsWithRef<"input">, "type">) {
  const t = useT();
  const auto = useId();
  const fieldId = id ?? auto;
  const meta = { label, helper, error, optional };
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const hide = () => setVisible(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof externalRef === "function") externalRef(node);
    else if (externalRef) externalRef.current = node;
  };

  return (
    <Shell id={fieldId} meta={meta}>
      <div className={styles.passwordWrap}>
        <input
          ref={setRefs}
          id={fieldId}
          type={visible ? "text" : "password"}
          className={`${styles.control} ${styles.passwordControl} ${error ? styles.invalid : ""} ${className ?? ""}`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...aria(fieldId, meta)}
          {...rest}
        />
        <button
          type="button"
          className={styles.reveal}
          aria-label={t.common.showPassword}
          aria-pressed={visible}
          aria-controls={fieldId}
          onClick={() => {
            setVisible((v) => !v);
            inputRef.current?.focus();
          }}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </Shell>
  );
}
