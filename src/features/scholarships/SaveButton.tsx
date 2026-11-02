"use client";

import { Button } from "@/components/ui/Button";
import type { ScholarshipSummary } from "@/types";
import { useApplications } from "@/features/applications/ApplicationsProvider";
import styles from "./SaveButton.module.css";

/** Rótulo constante + aria-pressed (estado salvo), conforme o padrão de botão de alternância. */
export function SaveButton({ scholarship, variant = "tertiary", label = "Salvar" }: { scholarship: ScholarshipSummary; variant?: "tertiary" | "secondary" | "primary"; label?: string }) {
  const { isSaved, save, remove } = useApplications();
  const saved = isSaved(scholarship.id);
  const summary: ScholarshipSummary = { id: scholarship.id, title: scholarship.title, institution: scholarship.institution, deadline: scholarship.deadline };
  return (
    <Button
      variant={variant}
      size="sm"
      className={styles.saved}
      aria-pressed={saved}
      onClick={() => (saved ? remove(summary.id) : save(summary))}
    >
      {label}
    </Button>
  );
}
