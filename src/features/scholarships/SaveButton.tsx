"use client";

import { Button } from "@/components/ui/Button";
import type { ScholarshipSummary } from "@/types";
import { useApplications } from "@/features/applications/ApplicationsProvider";
import { useT } from "@/i18n/I18nProvider";
import styles from "./SaveButton.module.css";

/**
 * Rótulo constante + aria-pressed (estado salvo), conforme o padrão de botão de alternância.
 * O nome acessível inclui o título da bolsa para que leitores de tela distingam os botões de uma lista.
 */
export function SaveButton({ scholarship, variant = "tertiary", label: labelProp }: { scholarship: ScholarshipSummary; variant?: "tertiary" | "secondary" | "primary"; label?: string }) {
  const t = useT();
  const label = labelProp ?? t.scholarships.save;
  const { isSaved, save, remove, status } = useApplications();
  const saved = isSaved(scholarship.id);
  const summary: ScholarshipSummary = { id: scholarship.id, title: scholarship.title, institution: scholarship.institution, deadline: scholarship.deadline };
  return (
    <Button
      variant={variant}
      size="sm"
      className={styles.saved}
      aria-pressed={saved}
      aria-label={t.scholarships.saveNamed(label, scholarship.title)}
      disabled={status !== "ready"}
      onClick={() => void (saved ? remove(summary.id) : save(summary))}
    >
      {label}
    </Button>
  );
}
