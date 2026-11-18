"use client";

import { useEffect, useState } from "react";
import type { ComponentPropsWithRef } from "react";
import { TextField } from "@/components/ui/Field";

type Props = Omit<ComponentPropsWithRef<"input">, "value" | "onChange" | "type"> & {
  label: string; helper?: string; error?: string; optional?: boolean;
  value: number | null;
  /** null = vazio; NaN = texto que não é número (a validação mostra o erro). */
  onChange: (next: number | null) => void;
  decimal?: boolean;
};

const parse = (text: string, decimal: boolean): number | null => {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || (!decimal && !Number.isInteger(n))) return Number.NaN;
  return n;
};

/** Número digitado como texto: aceita vírgula decimal ("14,5") e não perde o que está sendo digitado. */
export function NumberInput({ value, onChange, decimal = false, ...rest }: Props) {
  const [text, setText] = useState(value === null || Number.isNaN(value) ? "" : String(value));
  useEffect(() => {
    // Valor mudou por fora (ex.: carregou do servidor): mostra o novo, salvo se for o mesmo número que está digitado.
    setText((current) => (parse(current, decimal) === value || (value !== null && Number.isNaN(value)) ? current : value === null ? "" : String(value)));
  }, [value, decimal]);
  return (
    <TextField
      {...rest}
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parse(e.target.value, decimal));
      }}
    />
  );
}
