"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DeadlineBadge } from "@/components/ui/DeadlineBadge";
import type { BadgeTone } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils/date";
import { useT } from "@/i18n/I18nProvider";
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

/** `headingLevel`: 3 quando o cartão está sob uma seção com h2 (painel); 2 quando está logo abaixo do h1 (busca). */
export function ScholarshipCard({ item, headingLevel = 3 }: { item: Scholarship; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useT();
  return (
    <li className={styles.row}>
      <span className={styles.mono} aria-hidden="true">{initials(item.institution)}</span>
      <div className={styles.body}>
        <p className="t-label">{item.country} · {t.levels[item.level] ?? item.level}</p>
        <Heading className={styles.title}><Link href={`/scholarships/${item.id}`}>{item.title}</Link></Heading>
        <p className="t-secondary">{item.institution}</p>
        <div className={patterns.meta}>
          <Badge tone={fundingTone(item.fundingType)}>{item.fundingType}</Badge>
          <span>{t.deadline.prefix} {formatDate(item.deadline, t.meta.dateLocale, t.common.dateInvalid)}</span>
          <DeadlineBadge deadline={item.deadline} />
          <Badge tone="outline">{item.verification.status === "verified" ? t.scholarships.verified : t.scholarships.unverified}</Badge>
        </div>
      </div>
      <div className={styles.actions}>
        <SaveButton scholarship={item} />
        <Link className="t-secondary" href={`/scholarships/${item.id}`}>{t.scholarships.details}</Link>
      </div>
    </li>
  );
}
