"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/feedback/States";
import { FormSkeleton } from "@/components/feedback/Skeleton";
import { useT } from "@/i18n/I18nProvider";
import { STUDY_LEVELS } from "@/lib/constants";
import { IS_MOCK_MODE } from "@/lib/config";
import { ApiError } from "@/lib/api/client";
import type { ProfileService } from "@/lib/api/profile";
import { profileService } from "@/lib/services";
import { clearFormDraft, readFormDraft, writeFormDraft } from "@/lib/formDrafts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import { PROFILE_MAX_LENGTH, emptyProfile, validateProfile } from "@/lib/validation/profile";
import type { ProfileErrorCode, ProfileErrors, ProfileField } from "@/lib/validation/profile";
import type { ProfileInput } from "@/types";
import styles from "./ProfileForm.module.css";

/** Ordem visual dos campos, usada para focar o primeiro com erro. */
const FIELD_ORDER: ProfileField[] = ["residence", "nationality", "level", "field", "grade", "languages", "interests"];
const DRAFT_KEY = "profile";

const isProfileInput = (v: unknown): v is ProfileInput =>
  typeof v === "object" && v !== null && FIELD_ORDER.every((k) => typeof (v as Record<string, unknown>)[k] === "string");
const sameProfile = (a: ProfileInput, b: ProfileInput) => FIELD_ORDER.every((k) => a[k] === b[k]);

type LoadStatus = "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "failed";

export function ProfileForm({ service = profileService }: { service?: ProfileService }) {
  const t = useT();
  const [values, setValues] = useState<ProfileInput>(emptyProfile);
  const [serverValues, setServerValues] = useState<ProfileInput>(emptyProfile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [restored, setRestored] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus("loading");
    service
      .get(controller.signal)
      .then((profile) => {
        const { updatedAt: _ignored, ...input } = profile;
        const fromServer = { ...emptyProfile, ...input };
        setServerValues(fromServer);
        // Edição não salva de uma visita anterior nesta aba? Recupera e avisa.
        const unsaved = readFormDraft(DRAFT_KEY, isProfileInput);
        if (unsaved && !sameProfile(unsaved, fromServer)) {
          setValues(unsaved);
          setRestored(true);
        } else {
          setValues(fromServer);
          clearFormDraft(DRAFT_KEY);
        }
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadStatus("error");
      });
    return () => controller.abort();
  }, [service, reloadKey]);

  const dirty = loadStatus === "ready" && !sameProfile(values, serverValues);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (loadStatus !== "ready") return;
    if (dirty) writeFormDraft(DRAFT_KEY, values);
    else clearFormDraft(DRAFT_KEY);
  }, [values, dirty, loadStatus]);

  const messageFor = (field: ProfileField, code: ProfileErrorCode | undefined): string | undefined => {
    if (!code) return undefined;
    if (code === "required") return field === "residence" ? t.profile.required.residence : field === "level" ? t.profile.required.level : t.profile.required.other;
    return t.profile.tooLong(PROFILE_MAX_LENGTH[field]);
  };

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

  const discard = () => {
    setValues(serverValues);
    setErrors({});
    setRestored(false);
    clearFormDraft(DRAFT_KEY);
  };

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
      const fromServer = { ...emptyProfile, ...input };
      setServerValues(fromServer);
      setValues(fromServer);
      setRestored(false);
      clearFormDraft(DRAFT_KEY);
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

  if (loadStatus === "loading") return <FormSkeleton fields={6} label={t.profile.loading} />;
  if (loadStatus === "error") return <ErrorState title={t.profile.loadFailed} onRetry={() => setReloadKey((k) => k + 1)} />;

  const hasErrors = Object.keys(errors).length > 0;
  const levelLabel = (value: string) => t.levels[value] ?? value;

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-label={t.profile.formLabel}>
      {restored && (
        <div className={styles.restored} role="status">
          <p>{t.profile.restored}</p>
          <Button variant="tertiary" size="sm" onClick={discard}>{t.profile.discard}</Button>
        </div>
      )}

      <section className={styles.section} aria-labelledby="p-origin">
        <div><p className="t-label">{t.profile.s1}</p><h2 id="p-origin" className="t-section">{t.profile.s1Title}</h2></div>
        <div className={styles.fields}>
          <TextField label={t.profile.residence} placeholder={t.profile.residencePlaceholder} helper={t.profile.residenceHelper} autoComplete="country-name" required {...bind("residence")} />
          <TextField label={t.profile.nationality} optional {...bind("nationality")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-edu">
        <div><p className="t-label">{t.profile.s2}</p><h2 id="p-edu" className="t-section">{t.profile.s2Title}</h2></div>
        <div className={styles.fields}>
          <SelectField label={t.profile.level} required {...bind("level")}>
            <option value="">{t.profile.select}</option>
            {STUDY_LEVELS.map((l) => <option key={l} value={l}>{levelLabel(l)}</option>)}
          </SelectField>
          <TextField label={t.profile.field} optional placeholder={t.profile.fieldPlaceholder} {...bind("field")} />
          <TextField label={t.profile.grade} optional placeholder={t.profile.gradePlaceholder} helper={t.profile.gradeHelper} {...bind("grade")} />
          <TextField label={t.profile.languages} optional placeholder={t.profile.languagesPlaceholder} {...bind("languages")} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="p-goals">
        <div><p className="t-label">{t.profile.s3}</p><h2 id="p-goals" className="t-section">{t.profile.s3Title}</h2></div>
        <TextAreaField label={t.profile.interests} optional placeholder={t.profile.interestsPlaceholder} {...bind("interests")} />
      </section>

      {hasErrors && <Notice role="alert">{t.profile.fixErrors}</Notice>}
      {saveStatus === "failed" && !hasErrors && <Notice role="alert">{t.profile.saveFailed}</Notice>}
      <div className={styles.foot}>
        <Button type="submit" loading={saveStatus === "saving"}>{t.profile.save}</Button>
        <span className="t-secondary" role="status">
          {saveStatus === "saved" && (IS_MOCK_MODE ? t.profile.savedDemo : t.profile.saved)}
          {saveStatus !== "saved" && dirty && <span className="t-meta">{t.profile.unsaved}</span>}
        </span>
      </div>
      {IS_MOCK_MODE && <p className="t-meta">{t.profile.demoWarning}</p>}
    </form>
  );
}
