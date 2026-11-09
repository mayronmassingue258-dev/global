"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import type { AuthService } from "@/lib/api/auth";
import { authService } from "@/lib/services";
import styles from "./AuthForm.module.css";

/** Nova senha a partir do link do e-mail (?token=). O token vale 1 hora e só uma vez. */
export function ResetPasswordForm({ service = authService }: { service?: AuthService }) {
  const t = useT();
  const token = useSearchParams()?.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid">(token ? "idle" : "invalid");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError(t.auth.errors.passwordShort);
      inputRef.current?.focus();
      return;
    }
    setState("busy");
    try {
      await service.resetPassword(token, password);
      setState("done");
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_token") setState("invalid");
      else {
        setState("idle");
        setError(err instanceof ApiError && err.status === 429 ? t.auth.tooMany : t.auth.failed);
      }
    }
  }

  if (state === "done") {
    return (
      <div className={styles.form}>
        <Notice role="status">{t.auth.resetDone}</Notice>
        <div><ButtonLink href="/login">{t.auth.goToLogin}</ButtonLink></div>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className={styles.form}>
        <Notice role="alert">{t.auth.resetInvalid}</Notice>
        <div><ButtonLink href="/forgot-password" variant="secondary">{t.auth.requestNewLink}</ButtonLink></div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <PasswordField
        ref={inputRef}
        label={t.auth.newPassword}
        name="password"
        autoComplete="new-password"
        helper={t.auth.passwordHelper}
        required
        value={password}
        error={error || undefined}
        onChange={(e) => { setPassword(e.target.value); setError(""); }}
      />
      <Button type="submit" loading={state === "busy"}>{t.auth.resetSubmit}</Button>
      <div className={styles.links}><Link href="/login">{t.auth.backToLogin}</Link></div>
    </form>
  );
}
