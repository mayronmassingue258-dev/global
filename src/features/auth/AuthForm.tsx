"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import type { AuthService } from "@/lib/api/auth";
import { safeNextPath } from "@/lib/auth/routes";
import { authService } from "@/lib/services";
import { validateAuth, type AuthErrors, type AuthField, type AuthMode } from "@/lib/validation/auth";
import styles from "./AuthForm.module.css";

export type { AuthMode };

const ORDER: AuthField[] = ["name", "email", "password"];

/**
 * Login, cadastro e "esqueci a senha", ligados ao backend (sessão por cookie HttpOnly).
 * Depois de entrar, volta para a página que pediu login (?next=), só se for um caminho interno.
 */
export function AuthForm({ mode, service = authService }: { mode: AuthMode; service?: AuthService }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [values, setValues] = useState<Record<AuthField, string>>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const messageFor = (field: AuthField): string | undefined => {
    const code = errors[field];
    if (!code) return undefined;
    if (field === "name") return t.auth.errors.nameRequired;
    if (field === "email") return code === "taken" ? t.auth.emailTaken : code === "invalid" ? t.auth.errors.emailInvalid : t.auth.errors.emailRequired;
    return code === "too_short" ? t.auth.errors.passwordShort : t.auth.errors.passwordRequired;
  };

  const focusField = (field: AuthField) =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus());

  const bind = (field: AuthField) => ({
    name: field,
    value: values[field],
    error: messageFor(field),
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
      if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest);
      setFormError("");
    }
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = validateAuth(mode, values);
    setErrors(next);
    setFormError("");
    setMessage("");
    const first = ORDER.find((f) => next[f]);
    if (first) {
      focusField(first);
      return;
    }

    setBusy(true);
    try {
      if (mode === "forgot") {
        await service.forgotPassword(values.email.trim());
        setMessage(t.auth.forgotSent);
        setBusy(false);
        return;
      }
      if (mode === "register") await service.register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      else await service.login(values.email.trim(), values.password);
      router.replace(safeNextPath(params?.get("next")));
      router.refresh();
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.code === "email_taken") {
        setErrors({ email: "taken" });
        focusField("email");
      } else if (error instanceof ApiError && error.code === "invalid_credentials") {
        setFormError(t.auth.invalidCredentials);
        setValues((v) => ({ ...v, password: "" }));
        focusField("password");
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(t.auth.tooMany);
      } else {
        setFormError(t.auth.failed);
      }
    }
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
      {formError && <Notice role="alert">{formError}</Notice>}
      <Button type="submit" loading={busy}>{t.auth.submit[mode]}</Button>
      {message && <Notice role="status">{message}</Notice>}
      <div className={styles.links}>
        {mode === "login" && <><Link href="/forgot-password">{t.auth.forgotLink}</Link><Link href="/register">{t.auth.toRegister}</Link></>}
        {mode === "register" && <Link href="/login">{t.auth.toLogin}</Link>}
        {mode === "forgot" && <Link href="/login">{t.auth.backToLogin}</Link>}
      </div>
    </form>
  );
}
