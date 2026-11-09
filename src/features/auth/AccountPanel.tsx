"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/Field";
import { Notice } from "@/components/feedback/States";
import { useT } from "@/i18n/I18nProvider";
import { ApiError } from "@/lib/api/client";
import { ACCOUNT_EXPORT_PATH, type AuthService } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/config";
import { authService } from "@/lib/services";
import { useSessionUser } from "./SessionProvider";
import styles from "./AccountPanel.module.css";

/** Dados da conta, exportação (direito de acesso) e exclusão (direito de apagar). */
export function AccountPanel({ service = authService }: { service?: AuthService }) {
  const t = useT();
  const user = useSessionUser();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError(t.auth.errors.passwordRequired);
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await service.deleteAccount(password);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setBusy(false);
      setPassword("");
      setError(err instanceof ApiError && err.fields?.password === "incorrect" ? t.account.deleteWrongPassword : t.account.deleteFailed);
      inputRef.current?.focus();
    }
  }

  return (
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="acc-details">
        <h2 id="acc-details" className={styles.title}>{t.account.details}</h2>
        <dl className={styles.facts}>
          <div><dt>{t.account.name}</dt><dd>{user?.name}</dd></div>
          <div><dt>{t.account.email}</dt><dd>{user?.email}</dd></div>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="acc-export">
        <h2 id="acc-export" className={styles.title}>{t.account.exportTitle}</h2>
        <p className="t-secondary">{t.account.exportText}</p>
        <div>
          <a className={styles.button} href={`${API_BASE_URL ?? ""}${ACCOUNT_EXPORT_PATH}`} download>
            <Download size={16} aria-hidden="true" /> {t.account.exportButton}
          </a>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.danger}`} aria-labelledby="acc-delete">
        <h2 id="acc-delete" className={styles.title}>{t.account.deleteTitle}</h2>
        <p className="t-secondary">{t.account.deleteText}</p>
        <form className={styles.form} onSubmit={deleteAccount} noValidate>
          <PasswordField
            ref={inputRef}
            label={t.account.deleteConfirm}
            name="password"
            autoComplete="current-password"
            value={password}
            error={error || undefined}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
          />
          {error && <Notice role="alert">{error}</Notice>}
          <div><Button type="submit" variant="destructive" loading={busy}>{t.account.deleteButton}</Button></div>
        </form>
      </section>
    </div>
  );
}
