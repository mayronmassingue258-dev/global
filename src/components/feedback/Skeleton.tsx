import styles from "./Skeleton.module.css";

/** Bloco cinza animado no formato do conteúdo que vai chegar. Sempre decorativo. */
export function Skeleton({ width = "100%", height = 14, radius }: { width?: string | number; height?: string | number; radius?: number }) {
  return <span className={styles.block} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

/**
 * Esqueleto de lista. O texto `label` é anunciado a leitores de tela (role=status) e fica invisível na tela.
 * `variant="card"` imita ScholarshipCard; `"row"` imita linhas simples (candidaturas, prazos).
 */
export function ListSkeleton({ rows = 3, label, variant = "row" }: { rows?: number; label?: string; variant?: "row" | "card" }) {
  return (
    <div className={styles.list} aria-busy="true">
      {label && <p role="status" className="visually-hidden">{label}</p>}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={variant === "card" ? styles.card : styles.row}>
          {variant === "card" && <Skeleton width={48} height={48} radius={8} />}
          <div className={styles.lines}>
            {variant === "card" && <Skeleton width="30%" height={10} />}
            <Skeleton width={i % 2 ? "55%" : "70%"} height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Esqueleto de formulário/painel: rótulos e campos. */
export function FormSkeleton({ fields = 4, label }: { fields?: number; label: string }) {
  return (
    <div className={styles.form} aria-busy="true">
      <p role="status" className="visually-hidden">{label}</p>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className={styles.field}>
          <Skeleton width="25%" height={12} />
          <Skeleton height={44} radius={8} />
        </div>
      ))}
    </div>
  );
}
