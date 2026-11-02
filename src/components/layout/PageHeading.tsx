import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./PageHeading.module.css";

export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className={styles.heading}>
      <p className="t-label">{eyebrow}</p>
      <h1 className="t-title">{title}</h1>
      {description && <p className="t-secondary">{description}</p>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <p className={styles.back}><Link href={href}>← {children}</Link></p>;
}
