"use client";

import { useId } from "react";
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
