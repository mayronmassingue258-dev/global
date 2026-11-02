import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { BadgeTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/date";
import type { Scholarship } from "@/types";
import patterns from "@/styles/patterns.module.css";
import { SaveButton } from "./SaveButton";
import styles from "./ScholarshipCard.module.css";

function fundingTone(type: string): BadgeTone {
  if (type === "Integral") return "success";
  if (type === "Parcial") return "warning";
  return "neutral";
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function ScholarshipCard({ item }: { item: Scholarship }) {
  return (
    <li className={styles.row}>
      <span className={styles.mono} aria-hidden="true">{initials(item.institution)}</span>
      <div className={styles.body}>
        <p className="t-label">{item.country} · {item.level}</p>
        <h3 className={styles.title}><Link href={`/scholarships/${item.id}`}>{item.title}</Link></h3>
        <p className="t-secondary">{item.institution}</p>
        <div className={patterns.meta}>
          <Badge tone={fundingTone(item.fundingType)}>{item.fundingType}</Badge>
          <span>Prazo: {formatDate(item.deadline)}</span>
          <Badge tone="outline">{item.verification.status === "verified" ? "Verificada" : "Não verificada"}</Badge>
        </div>
      </div>
      <div className={styles.actions}>
        <SaveButton scholarship={item} />
        <Link className="t-secondary" href={`/scholarships/${item.id}`}>Ver detalhes</Link>
      </div>
    </li>
  );
}
