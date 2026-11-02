"use client";

import { Button } from "@/components/ui/Button";
import styles from "./status-page.module.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <p className="t-label">Algo deu errado</p>
      <h1 className="t-title">Não foi possível carregar esta página.</h1>
      <p className="t-secondary">Tente novamente. Se o problema continuar, volte mais tarde.</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
