"use client";

import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import styles from "./status-page.module.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <main id="main" className={`container ${styles.page}`}>
      <p className="t-label">{t.errorPage.label}</p>
      <h1 className="t-title">{t.errorPage.title}</h1>
      <p className="t-secondary">{t.errorPage.text}</p>
      <Button onClick={reset}>{t.common.retry}</Button>
    </main>
  );
}
