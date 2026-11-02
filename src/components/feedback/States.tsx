import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./States.module.css";

export function Notice({ children, role }: { children: ReactNode; role?: "status" | "alert" }) {
  return <p className={styles.notice} role={role}>{children}</p>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <p className="t-component">{title}</p>
      {description && <p className="t-secondary">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Não foi possível carregar", description = "Verifique sua conexão e tente novamente.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <p className="t-component">{title}</p>
      <p className="t-secondary">{description}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}
