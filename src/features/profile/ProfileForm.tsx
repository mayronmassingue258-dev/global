"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CheckboxGroup, RadioGroup } from "@/components/ui/Choice";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { ErrorState, Notice } from "@/components/feedback/States";
import { FormSkeleton } from "@/components/feedback/Skeleton";
import { useT } from "@/i18n/I18nProvider";
import { IS_MOCK_MODE } from "@/lib/config";
import { ApiError } from "@/lib/api/client";
import type { ProfileService } from "@/lib/api/profile";
import { profileService } from "@/lib/services";
import { clearFormDraft, readFormDraft, writeFormDraft } from "@/lib/formDrafts";
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning";
import {
  COMPLETED_LEVELS, COVERAGE, EXPERIENCE, FIELDS, FUNDING_NEEDS, GPA_SCALES, GROUPS, LANGUAGE_LEVELS, LANGUAGES, STUDY_MODES,
  TARGET_LEVELS, TESTS, sortedCountries, type GpaScale, type TestType
} from "@/lib/matching";
import { PROFILE_LIMITS, emptyProfile, toInput, validateProfile } from "@/lib/validation/profile";
import type { ProfileErrorCode, ProfileErrors, ProfileField } from "@/lib/validation/profile";
import type { Profile, ProfileInput } from "@/types";
import { CountryPicker } from "./CountryPicker";
import { NumberInput } from "./NumberInput";
import styles from "./ProfileForm.module.css";

export const STEPS = ["origin", "education", "languages", "experience", "goals", "finances"] as const;
type Step = (typeof STEPS)[number];

/** Em que etapa está cada campo (para levar a pessoa ao erro devolvido pelo servidor). */
const STEP_OF: Record<ProfileField, Step> = {
  nationalities: "origin", residenceCountry: "origin", birthYear: "origin", groups: "origin",
  completedLevel: "education", fields: "education", fieldDetail: "education", gpa: "education", graduationYear: "education",
  languages: "languages", tests: "languages",
  workYears: "experience", experience: "experience",
  targetLevels: "goals", destinations: "goals", excludedDestinations: "goals", studyMode: "goals", startYear: "goals", goals: "goals",
  fundingNeed: "finances", needsCoverage: "finances", canPayApplicationFee: "finances"
};

/** Testes em edição: a nota pode estar vazia enquanto a pessoa digita. */
type TestDraft = { type: TestType; score: number | null };
type GpaDraft = { value: number | null; scale: GpaScale | "" };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Cópia de segurança do que foi digitado e não salvo (sessionStorage da aba; ver lib/formDrafts). */
const DRAFT_KEY = "profile-v2";
type Draft = { values: ProfileInput; gpa: GpaDraft; tests: TestDraft[] };
const isDraft = (v: unknown): v is Draft => {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  const values = d.values as Record<string, unknown> | undefined;
  return typeof values === "object" && values !== null && Object.keys(emptyProfile).every((k) => k in values) && typeof d.gpa === "object" && Array.isArray(d.tests);
};

export function ProfileForm({ service = profileService, initialStep = 0 }: { service?: ProfileService; initialStep?: number }) {
  const t = useT();
  const router = useRouter();
  const locale = t.meta.htmlLang;
  const countries = useMemo(() => sortedCountries(locale), [locale]);
  const thisYear = new Date().getFullYear();

  const [values, setValues] = useState<ProfileInput>(emptyProfile);
  const [server, setServer] = useState<ProfileInput>(emptyProfile);
  const [gpa, setGpa] = useState<GpaDraft>({ value: null, scale: "" });
  const [tests, setTests] = useState<TestDraft[]>([]);
  const [completeness, setCompleteness] = useState(0);
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 0), STEPS.length - 1));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const applyServer = (p: Profile) => {
    const input = toInput(p);
    setServer(input);
    setValues(input);
    setGpa(input.gpa ? { value: input.gpa.value, scale: input.gpa.scale } : { value: null, scale: "" });
    setTests(input.tests.map((x) => ({ ...x })));
    setCompleteness(p.completeness.percent);
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoad("loading");
    service.get(controller.signal)
      .then((p) => {
        applyServer(p);
        // Edição não salva de uma visita anterior nesta aba? Recupera e avisa.
        const draft = readFormDraft(DRAFT_KEY, isDraft);
        if (draft && !same(draft.values, toInput(p))) {
          setValues({ ...emptyProfile, ...draft.values });
          setGpa(draft.gpa);
          setTests(draft.tests);
          setRestored(true);
        } else clearFormDraft(DRAFT_KEY);
        setLoad("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setLoad("error"); });
    return () => controller.abort();
  }, [service, reloadKey]);

  /** O perfil que seria enviado: junta os rascunhos de nota e testes. */
  const current = (): ProfileInput => ({
    ...values,
    gpa: gpa.value === null && gpa.scale === "" ? null : { value: gpa.value ?? Number.NaN, scale: (gpa.scale || "20") as GpaScale },
    tests: tests.map((x) => ({ type: x.type, score: x.score ?? Number.NaN }))
  });

  const dirty = load === "ready" && !same(current(), server);
  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (load !== "ready") return;
    if (dirty) writeFormDraft(DRAFT_KEY, { values, gpa, tests } satisfies Draft);
    else clearFormDraft(DRAFT_KEY);
  }, [values, gpa, tests, dirty, load]);

  const discard = () => {
    setValues(server);
    setGpa(server.gpa ? { value: server.gpa.value, scale: server.gpa.scale } : { value: null, scale: "" });
    setTests(server.tests.map((x) => ({ ...x })));
    setErrors({});
    setRestored(false);
    clearFormDraft(DRAFT_KEY);
  };

  /** Campo mexido: some o erro dele e o aviso de "salvo". */
  const touch = (key: ProfileField) => {
    if (errors[key]) setErrors(({ [key]: _removed, ...rest }) => rest);
    if (save !== "saving") setSave("idle");
  };
  const set = <K extends ProfileField>(key: K, value: ProfileInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    touch(key);
  };
  const err = (key: ProfileField) => (errors[key] ? t.profile.errors[errors[key] as ProfileErrorCode] : undefined);

  const goTo = (index: number) => {
    setStep(index);
    setErrors({});
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const focusFirstError = (next: ProfileErrors) => {
    const first = (Object.keys(STEP_OF) as ProfileField[]).find((k) => next[k]);
    if (!first) return;
    const target = STEPS.indexOf(STEP_OF[first]);
    if (target !== step) setStep(target);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"], [data-name="${first}"] input`)?.focus());
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = current();
    const next = validateProfile(input);
    if (gpa.value !== null && gpa.scale === "") next.gpa = "required";
    if (gpa.value === null && gpa.scale !== "") next.gpa = "required";
    if (tests.some((x) => x.score === null)) next.tests = "required";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSave("idle");
      focusFirstError(next);
      return;
    }
    setSave("saving");
    try {
      const saved = await service.update({ ...input, fieldDetail: input.fieldDetail.trim(), goals: input.goals.trim() });
      applyServer(saved);
      setRestored(false);
      clearFormDraft(DRAFT_KEY);
      setSave("saved");
      if (step === STEPS.length - 1) router.push("/recommendations");
      else goTo(step + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.fields) {
        const fromServer: ProfileErrors = {};
        for (const key of Object.keys(STEP_OF) as ProfileField[]) {
          const code = error.fields[key];
          if (code) fromServer[key] = (code in t.profile.errors ? code : "invalid_type") as ProfileErrorCode;
        }
        setErrors(fromServer);
        focusFirstError(fromServer);
      }
      setSave("failed");
    }
  }

  if (load === "loading") return <FormSkeleton fields={6} label={t.profile.loading} />;
  if (load === "error") return <ErrorState title={t.profile.loadFailed} onRetry={() => setReloadKey((k) => k + 1)} />;

  const id = STEPS[step]!;
  const info = t.profile.steps[id];
  const v = t.vocab;
  const opts = <K extends string>(codes: readonly K[], table: Record<K, string>) => codes.map((c) => ({ value: c, label: table[c] }));
  const hasErrors = Object.keys(errors).length > 0;
  const usedLanguages = new Set(values.languages.map((l) => l.code));
  const usedTests = new Set(tests.map((x) => x.type));

  return (
    <div className={styles.wrap}>
      <div className={styles.progress}>
        <p className={styles.progressText}>{t.profile.completeness(completeness)}</p>
        <span className={styles.bar} aria-hidden="true"><span style={{ width: `${Math.max(3, completeness)}%` }} /></span>
      </div>

      <nav aria-label={t.profile.stepsLabel}>
        <ol className={styles.steps}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" className={styles.stepButton} aria-current={i === step ? "step" : undefined} onClick={() => goTo(i)}>
                <span className={styles.stepNumber} aria-hidden="true">{i + 1}</span>
                {t.profile.steps[s].title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {restored && (
        <div className={styles.restored} role="status">
          <p>{t.profile.restored}</p>
          <Button variant="tertiary" size="sm" onClick={discard}>{t.profile.discard}</Button>
        </div>
      )}

      <form ref={formRef} className={styles.form} onSubmit={submit} noValidate aria-label={t.profile.formLabel}>
        <header className={styles.stepHeader}>
          <p className="t-label">{t.profile.step(step + 1, STEPS.length)}</p>
          <h2 ref={headingRef} tabIndex={-1} className="t-section">{info.heading}</h2>
          <p className="t-secondary t-measure">{info.text}</p>
        </header>

        {id === "origin" && (
          <div className={styles.fields}>
            <CountryPicker name="nationalities" label={t.profile.nationalities} helper={t.profile.nationalitiesHelper} value={values.nationalities} max={PROFILE_LIMITS.nationalities} error={err("nationalities")} onChange={(x) => set("nationalities", x)} />
            <SelectField name="residenceCountry" label={t.profile.residenceCountry} value={values.residenceCountry} error={err("residenceCountry")} onChange={(e) => set("residenceCountry", e.target.value as ProfileInput["residenceCountry"])}>
              <option value="">{t.profile.select}</option>
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </SelectField>
            <NumberInput name="birthYear" label={t.profile.birthYear} helper={t.profile.birthYearHelper} value={values.birthYear} error={err("birthYear")} onChange={(x) => set("birthYear", x)} autoComplete="bday-year" maxLength={4} />
            <div className={styles.full}>
              <CheckboxGroup name="groups" legend={t.profile.groupsLegend} helper={t.profile.groupsHelper} optional columns={2} value={values.groups} options={opts(GROUPS, v.group)} onChange={(x) => set("groups", x)} />
            </div>
          </div>
        )}

        {id === "education" && (
          <div className={styles.fields}>
            <SelectField name="completedLevel" label={t.profile.completedLevel} value={values.completedLevel} error={err("completedLevel")} onChange={(e) => set("completedLevel", e.target.value as ProfileInput["completedLevel"])}>
              <option value="">{t.profile.select}</option>
              {COMPLETED_LEVELS.map((l) => <option key={l} value={l}>{v.completedLevel[l]}</option>)}
            </SelectField>
            <NumberInput name="graduationYear" label={t.profile.graduationYear} value={values.graduationYear} error={err("graduationYear")} onChange={(x) => set("graduationYear", x)} maxLength={4} />
            <div className={styles.full}>
              <CheckboxGroup name="fields" legend={t.profile.fields} helper={t.profile.fieldsHelper} columns={2} max={PROFILE_LIMITS.fields} value={values.fields} options={opts(FIELDS, v.field)} error={err("fields")} onChange={(x) => set("fields", x)} />
            </div>
            <TextField name="fieldDetail" label={t.profile.fieldDetail} optional placeholder={t.profile.fieldDetailPlaceholder} value={values.fieldDetail} maxLength={PROFILE_LIMITS.fieldDetail} error={err("fieldDetail")} onChange={(e) => set("fieldDetail", e.target.value)} />
            <div className={styles.pair}>
              <NumberInput name="gpa" decimal label={t.profile.gpaValue} value={gpa.value} error={err("gpa")} onChange={(x) => { setGpa((g) => ({ ...g, value: x })); touch("gpa"); }} />
              <SelectField name="gpaScale" label={t.profile.gpaScale} value={gpa.scale} onChange={(e) => { setGpa((g) => ({ ...g, scale: e.target.value as GpaScale | "" })); touch("gpa"); }}>
                <option value="">{t.profile.select}</option>
                {GPA_SCALES.map((s) => <option key={s} value={s}>{v.gpaScale[s]}</option>)}
              </SelectField>
              <p className={`${styles.pairHelper} t-meta`}>{t.profile.gpaHelper}</p>
            </div>
          </div>
        )}

        {id === "languages" && (
          <div className={styles.stack}>
            <fieldset className={styles.rows} data-name="languages">
              <legend className={styles.legend}>{t.profile.languagesLegend}</legend>
              {values.languages.map((l, i) => (
                <div key={i} className={styles.row}>
                  <SelectField label={t.profile.language} value={l.code} onChange={(e) => set("languages", values.languages.map((x, j) => (j === i ? { ...x, code: e.target.value as typeof l.code } : x)))}>
                    {LANGUAGES.filter((c) => c === l.code || !usedLanguages.has(c)).map((c) => <option key={c} value={c}>{v.language[c]}</option>)}
                  </SelectField>
                  <SelectField label={t.profile.level} value={l.level} onChange={(e) => set("languages", values.languages.map((x, j) => (j === i ? { ...x, level: e.target.value as typeof l.level } : x)))}>
                    {LANGUAGE_LEVELS.map((lv) => <option key={lv} value={lv}>{v.languageLevel[lv]}</option>)}
                  </SelectField>
                  <button type="button" className={styles.removeRow} aria-label={t.profile.remove(v.language[l.code])} onClick={() => set("languages", values.languages.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
                </div>
              ))}
              {err("languages") && <p className={styles.error}>{t.common.errorPrefix} {err("languages")}</p>}
              {values.languages.length < PROFILE_LIMITS.languages && (
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  const code = LANGUAGES.find((c) => !usedLanguages.has(c));
                  if (code) set("languages", [...values.languages, { code, level: values.languages.length === 0 ? "native" : "B2" }]);
                }}><Plus size={16} aria-hidden="true" /> {t.profile.addLanguage}</Button>
              )}
            </fieldset>

            <fieldset className={styles.rows} data-name="tests">
              <legend className={styles.legend}>{t.profile.testsLegend} <span className={styles.optional}>{t.common.optional}</span></legend>
              {tests.map((x, i) => (
                <div key={i} className={styles.row}>
                  <SelectField label={t.profile.test} value={x.type} onChange={(e) => { setTests(tests.map((y, j) => (j === i ? { ...y, type: e.target.value as TestType } : y))); touch("tests"); }}>
                    {TESTS.filter((c) => c === x.type || !usedTests.has(c)).map((c) => <option key={c} value={c}>{v.test[c]}</option>)}
                  </SelectField>
                  <NumberInput decimal label={t.profile.score} value={x.score} onChange={(n) => { setTests(tests.map((y, j) => (j === i ? { ...y, score: n } : y))); touch("tests"); }} />
                  <button type="button" className={styles.removeRow} aria-label={t.profile.remove(v.test[x.type])} onClick={() => { setTests(tests.filter((_, j) => j !== i)); touch("tests"); }}><X size={16} aria-hidden="true" /></button>
                </div>
              ))}
              {err("tests") && <p className={styles.error}>{t.common.errorPrefix} {err("tests")}</p>}
              {tests.length < PROFILE_LIMITS.tests && (
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  const type = TESTS.find((c) => !usedTests.has(c));
                  if (type) setTests([...tests, { type, score: null }]);
                }}><Plus size={16} aria-hidden="true" /> {t.profile.addTest}</Button>
              )}
            </fieldset>
          </div>
        )}

        {id === "experience" && (
          <div className={styles.fields}>
            <NumberInput name="workYears" label={t.profile.workYears} helper={t.profile.workYearsHelper} value={values.workYears} error={err("workYears")} onChange={(x) => set("workYears", x)} maxLength={2} />
            <div className={styles.full}>
              <CheckboxGroup name="experience" legend={t.profile.experienceLegend} optional columns={2} value={values.experience} options={opts(EXPERIENCE, v.experience)} onChange={(x) => set("experience", x)} />
            </div>
          </div>
        )}

        {id === "goals" && (
          <div className={styles.fields}>
            <div className={styles.full}>
              <CheckboxGroup name="targetLevels" legend={t.profile.targetLevels} columns={2} value={values.targetLevels} options={opts(TARGET_LEVELS, v.targetLevel)} error={err("targetLevels")} onChange={(x) => set("targetLevels", x)} />
            </div>
            <CountryPicker name="destinations" label={t.profile.destinations} helper={t.profile.destinationsHelper} optional value={values.destinations} max={PROFILE_LIMITS.destinations} error={err("destinations")} onChange={(x) => set("destinations", x)} />
            <CountryPicker name="excludedDestinations" label={t.profile.excludedDestinations} optional value={values.excludedDestinations} max={PROFILE_LIMITS.excludedDestinations} error={err("excludedDestinations")} onChange={(x) => set("excludedDestinations", x)} />
            <RadioGroup name="studyMode" legend={t.profile.studyMode} value={values.studyMode} options={opts(STUDY_MODES, v.studyMode)} onChange={(x) => set("studyMode", x)} />
            <SelectField name="startYear" label={t.profile.startYear} value={values.startYear === null ? "" : String(values.startYear)} error={err("startYear")} onChange={(e) => set("startYear", e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t.profile.select}</option>
              {Array.from({ length: 7 }, (_, i) => thisYear + i).map((y) => <option key={y} value={y}>{y}</option>)}
            </SelectField>
            <div className={styles.full}>
              <TextAreaField name="goals" label={t.profile.goals} placeholder={t.profile.goalsPlaceholder} value={values.goals} maxLength={PROFILE_LIMITS.goals} error={err("goals")} onChange={(e) => set("goals", e.target.value)} rows={4} />
            </div>
          </div>
        )}

        {id === "finances" && (
          <div className={styles.stack}>
            <RadioGroup name="fundingNeed" legend={t.profile.fundingNeed} value={values.fundingNeed} options={opts(FUNDING_NEEDS, v.fundingNeed)} onChange={(x) => set("fundingNeed", x)} />
            <CheckboxGroup name="needsCoverage" legend={t.profile.needsCoverage} helper={t.profile.needsCoverageHelper} optional columns={2} value={values.needsCoverage} options={opts(COVERAGE, v.coverage)} onChange={(x) => set("needsCoverage", x)} />
            <RadioGroup
              name="canPayApplicationFee" legend={t.profile.canPayFee}
              value={values.canPayApplicationFee === null ? "" : values.canPayApplicationFee ? "yes" : "no"}
              options={[{ value: "yes", label: t.profile.yes }, { value: "no", label: t.profile.no }]}
              onChange={(x) => set("canPayApplicationFee", x === "yes")}
            />
          </div>
        )}

        {hasErrors && <Notice role="alert">{t.profile.fixErrors}</Notice>}
        {save === "failed" && !hasErrors && <Notice role="alert">{t.profile.saveFailed}</Notice>}
        <div className={styles.foot}>
          {step > 0 && <Button type="button" variant="tertiary" onClick={() => goTo(step - 1)}>{t.profile.back}</Button>}
          <Button type="submit" loading={save === "saving"}>{step === STEPS.length - 1 ? t.profile.finish : t.profile.next}</Button>
          <span className="t-secondary" role="status">
            {save === "saved" && !dirty && (IS_MOCK_MODE ? t.profile.savedDemo : t.profile.saved)}
            {dirty && <span className="t-meta">{t.profile.unsaved}</span>}
          </span>
        </div>
        {IS_MOCK_MODE && <p className="t-meta">{t.profile.demoWarning}</p>}
      </form>
    </div>
  );
}
