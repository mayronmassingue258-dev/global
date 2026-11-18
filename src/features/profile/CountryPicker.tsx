"use client";

import { useId, useMemo } from "react";
import { X } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { countryName, sortedCountries, type CountryCode } from "@/lib/matching";
import styles from "./CountryPicker.module.css";

type Props = { label: string; helper?: string; error?: string; optional?: boolean; name: string; value: CountryCode[]; onChange: (next: CountryCode[]) => void; max: number };

/**
 * Vários países: uma lista nativa para adicionar (acessível e boa no telemóvel) e etiquetas com botão de remover.
 * Os nomes seguem o idioma da interface; o valor guardado é sempre o código ISO.
 */
export function CountryPicker({ label, helper, error, optional, name, value, onChange, max }: Props) {
  const t = useT();
  const id = useId();
  const locale = t.meta.htmlLang;
  const options = useMemo(() => sortedCountries(locale), [locale]);
  const describedBy = [helper ? `${id}-helper` : "", error ? `${id}-error` : "", `${id}-count`].filter(Boolean).join(" ");
  const full = value.length >= max;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {optional && <span className={styles.optional}> {t.common.optional}</span>}
      </label>
      {value.length > 0 && (
        <ul className={styles.chips} aria-label={t.profile.selectedIn(label)}>
          {value.map((code) => (
            <li key={code} className={styles.chip}>
              <span>{countryName(code, locale)}</span>
              <button type="button" className={styles.remove} onClick={() => onChange(value.filter((c) => c !== code))} aria-label={t.profile.remove(countryName(code, locale))}>
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        id={id} name={name} className={`${styles.control} ${error ? styles.invalid : ""}`} value="" disabled={full}
        aria-describedby={describedBy} aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const code = e.target.value as CountryCode;
          if (code && !value.includes(code)) onChange([...value, code]);
        }}
      >
        <option value="">{t.profile.addCountry}</option>
        {options.filter((o) => !value.includes(o.code)).map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
      </select>
      <p id={`${id}-count`} className="visually-hidden" aria-live="polite">{t.profile.countriesSelected(value.length)}</p>
      {helper && <p id={`${id}-helper`} className={styles.helper}>{helper}</p>}
      {error && <p id={`${id}-error`} className={styles.error}>{t.common.errorPrefix} {error}</p>}
    </div>
  );
}
