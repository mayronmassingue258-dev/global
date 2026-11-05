"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import { validateAuth, type AuthErrors, type AuthField, type AuthMode } from "@/lib/validation/auth";
import styles from "./AuthForm.module.css";

export type { AuthMode };

const ORDER: AuthField[] = ["name", "email", "password"];

/** DEMONSTRAÇÃO: nenhuma autenticação real. Valida, mas não cria sessão nem finge que o usuário entrou. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const t = useT();
  const [values, setValues] = useState<Record<AuthField, string>>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const messageFor = (field: AuthField): string | undefined => {
    const code = errors[field];
    if (!code) return undefined;
    if (field === "name") return t.auth.errors.nameRequired;
    if (field === "email") return code === "invalid" ? t.auth.errors.emailInvalid : t.auth.errors.emailRequired;
    return code === "too_short" ? t.auth.errors.passwordShort : t.auth.errors.passwordRequired;
  };

  const bind = (field: AuthField) => ({
    name: field,
    value: values[field],
    error: messageFor(field),
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest);
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateAuth(mode, values);
    setErrors(next);
    const first = ORDER.find((f) => next[f]);
    if (first) {
      setMessage("");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
      return;
    }
    setMessage(t.auth.demo);
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} noValidate>
      {mode === "register" && <TextField label={t.auth.name} autoComplete="name" required {...bind("name")} />}
      <TextField label={t.auth.email} type="email" autoComplete="email" required {...bind("email")} />
      {mode !== "forgot" && (
        <PasswordField
          label={t.auth.password}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          helper={mode === "register" ? t.auth.passwordHelper : undefined}
          required
          {...bind("password")}
        />
      )}
      {hasErrors && <Notice role="alert">{t.auth.fixErrors}</Notice>}
      <Button type="submit">{t.auth.submit[mode]}</Button>
      {message && <Notice role="status">{message}</Notice>}
      <div className={styles.links}>
        {mode === "login" && <><Link href="/forgot-password">{t.auth.forgotLink}</Link><Link href="/register">{t.auth.toRegister}</Link></>}
        {mode === "register" && <Link href="/login">{t.auth.toLogin}</Link>}
        {mode === "forgot" && <Link href="/login">{t.auth.backToLogin}</Link>}
      </div>
    </form>
  );
}
