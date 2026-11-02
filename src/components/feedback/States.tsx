import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./States.module.css";

type IconType = ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" }>;

export function Notice({ children, role }: { children: ReactNode; role?: "status" | "alert" }) {
  return <p className={styles.notice} role={role}>{children}</p>;
}

export function EmptyState({ title, description, action, icon: Icon }: { title: string; description?: string; action?: ReactNode; icon?: IconType }) {
  return (
    <div className={styles.state}>
      {Icon && <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>}
      <p className="t-component">{title}</p>
      {description && <p className="t-secondary">{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Não foi possível carregar", description = "Verifique sua conexão e tente novamente.", onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <p className="t-component">{title}</p>
      <p className="t-secondary">{description}</p>
      {onRetry && <div className={styles.action}><Button variant="secondary" onClick={onRetry}>Tentar novamente</Button></div>}
    </div>
  );
}
