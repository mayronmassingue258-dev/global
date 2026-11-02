"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { STUDY_LEVELS } from "@/lib/constants";
import styles from "./ProfileForm.module.css";

type Values = { residence: string; nationality: string; level: string; field: string; grade: string; languages: string; interests: string };
const empty: Values = { residence: "", nationality: "", level: "", field: "", grade: "", languages: "", interests: "" };

/** DEMONSTRAÇÃO: o formulário valida e mantém os dados na tela, mas não os envia nem armazena. */
export function ProfileForm() {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [saved, setSaved] = useState(false);

  const bind = (key: keyof Values) => ({
    name: key,
    value: values[key],
    error: errors[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setSaved(false);
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Partial<Record<keyof Values, string>> = {};
    if (!values.residence.trim()) next.residence = "Informe o país de residência.";
    if (!values.level) next.level = "Selecione o nível de estudo atual.";
    setErrors(next);
    setSaved(Object.keys(next).length === 0);
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <section className={styles.section} aria-labelledby="p-origin">
        <div><p className="t-label">01 · Origem</p><h2 id="p-origin" className="t-section">Onde você está agora</h2></div>
        <div className={styles.fields}>
          <TextField label="País de residência" placeholder="Ex.: Moçambique" helper="Usado para avaliar a elegibilidade." autoComplete="country-name" {...bind("residence")} />
          <TextField label="Nacionalidade" optional {...bind("nationality")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-edu">
        <div><p className="t-label">02 · Formação</p><h2 id="p-edu" className="t-section">Sua trajetória acadêmica</h2></div>
        <div className={styles.fields}>
          <SelectField label="Nível de estudo atual" {...bind("level")}>
            <option value="">Selecione</option>
            {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </SelectField>
          <TextField label="Área de estudo" placeholder="Ex.: Ciência da Computação" {...bind("field")} />
          <TextField label="Resultado acadêmico e escala" optional placeholder="Ex.: 16 em 20" helper="Inclua a escala de notas da sua instituição." {...bind("grade")} />
          <TextField label="Idiomas e níveis" optional placeholder="Ex.: Português nativo, Inglês B2" {...bind("languages")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-goals">
        <div><p className="t-label">03 · Objetivos</p><h2 id="p-goals" className="t-section">O que você procura</h2></div>
        <TextAreaField label="Países e áreas de interesse" optional placeholder="Descreva seus objetivos e destinos preferidos." {...bind("interests")} />
      </section>

      {hasErrors && <Notice role="alert">Corrija os campos destacados para continuar.</Notice>}
      <div className={styles.foot}>
        <Button type="submit">Salvar perfil</Button>
        {saved && <span className="t-secondary" role="status">Demonstração: os dados não foram enviados a nenhum servidor.</span>}
      </div>
      <p className="t-meta">Não insira informações sensíveis neste formulário de demonstração.</p>
    </form>
  );
}
