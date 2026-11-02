"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/feedback/States";
import { FormSkeleton } from "@/components/feedback/Skeleton";
import { STUDY_LEVELS } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
import { ApiError } from "@/lib/api/client";
import type { ProfileService } from "@/lib/api/profile";
import { profileService } from "@/lib/services";
import { PROFILE_MAX_LENGTH, emptyProfile, validateProfile } from "@/lib/validation/profile";
import type { ProfileErrorCode, ProfileErrors, ProfileField } from "@/lib/validation/profile";
import type { ProfileInput } from "@/types";
import styles from "./ProfileForm.module.css";

const REQUIRED_MESSAGE: Partial<Record<ProfileField, string>> = {
  residence: "Informe o país de residência.",
  level: "Selecione o nível de estudo atual."
};

function messageFor(field: ProfileField, code: ProfileErrorCode | undefined): string | undefined {
  if (!code) return undefined;
  if (code === "required") return REQUIRED_MESSAGE[field] ?? "Campo obrigatório.";
  return `Use no máximo ${PROFILE_MAX_LENGTH[field]} caracteres.`;
}

/** Ordem visual dos campos, usada para focar o primeiro com erro. */
const FIELD_ORDER: ProfileField[] = ["residence", "nationality", "level", "field", "grade", "languages", "interests"];

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "failed";

export function ProfileForm({ service = profileService }: { service?: ProfileService }) {
  const [values, setValues] = useState<ProfileInput>(emptyProfile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus("loading");
    service
      .get(controller.signal)
      .then((profile) => {
        const { updatedAt: _ignored, ...input } = profile;
        setValues({ ...emptyProfile, ...input });
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus("error");
      });
    return () => controller.abort();
  }, [service, reloadKey]);

  const focusFirstError = (next: ProfileErrors) => {
    const first = FIELD_ORDER.find((key) => next[key]);
    if (!first) return;
    // Aguarda o React aplicar aria-invalid antes de mover o foco.
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  };

  const bind = (key: ProfileField) => ({
    name: key,
    value: values[key],
    error: messageFor(key, errors[key]),
    maxLength: PROFILE_MAX_LENGTH[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
      if (saveStatus !== "saving") setSaveStatus("idle");
    }
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateProfile(values);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSaveStatus("idle");
      focusFirstError(next);
      return;
    }
    setSaveStatus("saving");
    try {
      const saved = await service.update(values);
      const { updatedAt: _ignored, ...input } = saved;
      setValues({ ...emptyProfile, ...input });
      setSaveStatus("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.fields) {
        const serverErrors: ProfileErrors = {};
        for (const key of FIELD_ORDER) {
          const code = error.fields[key];
          if (code === "required" || code === "too_long") serverErrors[key] = code;
        }
        setErrors(serverErrors);
        focusFirstError(serverErrors);
      }
      setSaveStatus("failed");
    }
  }

  if (loadStatus === "loading") return <FormSkeleton fields={6} label="Carregando perfil…" />;
  if (loadStatus === "error") return <ErrorState title="Não foi possível carregar seu perfil" onRetry={() => setReloadKey((k) => k + 1)} />;

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-label="Perfil acadêmico">
      <section className={styles.section} aria-labelledby="p-origin">
        <div><p className="t-label">01 · Origem</p><h2 id="p-origin" className="t-section">Onde você está agora</h2></div>
        <div className={styles.fields}>
          <TextField label="País de residência" placeholder="Ex.: Moçambique" helper="Usado para avaliar a elegibilidade." autoComplete="country-name" required {...bind("residence")} />
          <TextField label="Nacionalidade" optional {...bind("nationality")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-edu">
        <div><p className="t-label">02 · Formação</p><h2 id="p-edu" className="t-section">Sua trajetória acadêmica</h2></div>
        <div className={styles.fields}>
          <SelectField label="Nível de estudo atual" required {...bind("level")}>
            <option value="">Selecione</option>
            {STUDY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </SelectField>
          <TextField label="Área de estudo" optional placeholder="Ex.: Ciência da Computação" {...bind("field")} />
          <TextField label="Resultado acadêmico e escala" optional placeholder="Ex.: 16 em 20" helper="Inclua a escala de notas da sua instituição." {...bind("grade")} />
          <TextField label="Idiomas e níveis" optional placeholder="Ex.: Português nativo, Inglês B2" {...bind("languages")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-goals">
        <div><p className="t-label">03 · Objetivos</p><h2 id="p-goals" className="t-section">O que você procura</h2></div>
        <TextAreaField label="Países e áreas de interesse" optional placeholder="Descreva seus objetivos e destinos preferidos." {...bind("interests")} />
      </section>

      {hasErrors && <Notice role="alert">Corrija os campos destacados para continuar.</Notice>}
      {saveStatus === "failed" && !hasErrors && <Notice role="alert">Não foi possível salvar o perfil. Tente novamente.</Notice>}
      <div className={styles.foot}>
        <Button type="submit" loading={saveStatus === "saving"}>Salvar perfil</Button>
        <span className="t-secondary" role="status">
          {saveStatus === "saved" && (IS_MOCK_MODE ? "Demonstração: perfil guardado só nesta aba, sem servidor." : "Perfil salvo.")}
        </span>
      </div>
      {IS_MOCK_MODE && <p className="t-meta">Não insira informações sensíveis neste formulário de demonstração.</p>}
    </form>
  );
}
