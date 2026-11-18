"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { useT } from "@/i18n/I18nProvider";
import styles from "./Choice.module.css";

type Option<V extends string> = { value: V; label: ReactNode; hint?: ReactNode };
type Common<V extends string> = { legend: string; helper?: string; error?: string; optional?: boolean; options: Option<V>[]; name: string; columns?: 1 | 2 };

/** Grupo de caixas de seleção (várias respostas). `max` desativa as demais opções ao atingir o limite. */
export function CheckboxGroup<V extends string>({ value, onChange, max, ...props }: Common<V> & { value: V[]; onChange: (next: V[]) => void; max?: number }) {
  const full = max !== undefined && value.length >= max;
  return (
    <Group {...props}>
      {props.options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <label key={o.value} className={styles.option}>
            <input
              type="checkbox" name={props.name} value={o.value} checked={checked} disabled={!checked && full}
              onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))}
            />
            <span className={styles.text}>{o.label}{o.hint && <span className={styles.hint}>{o.hint}</span>}</span>
          </label>
        );
      })}
    </Group>
  );
}

/** Grupo de botões de opção (uma resposta). */
export function RadioGroup<V extends string>({ value, onChange, ...props }: Common<V> & { value: V | ""; onChange: (next: V) => void }) {
  return (
    <Group {...props}>
      {props.options.map((o) => (
        <label key={o.value} className={styles.option}>
          <input type="radio" name={props.name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className={styles.text}>{o.label}{o.hint && <span className={styles.hint}>{o.hint}</span>}</span>
        </label>
      ))}
    </Group>
  );
}

function Group({ legend, helper, error, optional, name, columns = 1, children }: Omit<Common<string>, "options"> & { children: ReactNode }) {
  const t = useT();
  const id = useId();
  const describedBy = [helper ? `${id}-helper` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className={styles.group} aria-describedby={describedBy} aria-invalid={error ? true : undefined} data-name={name}>
      <legend className={styles.legend}>
        {legend}
        {optional && <span className={styles.optional}> {t.common.optional}</span>}
      </legend>
      {helper && <p id={`${id}-helper`} className={styles.helper}>{helper}</p>}
      <div className={columns === 2 ? styles.grid2 : styles.grid}>{children}</div>
      {error && <p id={`${id}-error`} className={styles.error}>{t.common.errorPrefix} {error}</p>}
    </fieldset>
  );
}
